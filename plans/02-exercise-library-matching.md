# Plan 2: Exercise Library + Fuzzy Matching

## Goal

A curated database of common exercises (sit ups, planks, side planks, squats,
…), each with a text description and/or a video link. When a user builds or
runs a workout, exercises they typed (via natural-language parsing or manual
entry) get matched against this library — even with different spelling/wording
— so we can show an info icon that surfaces the description/video.

This plan depends on [Plan 1](01-admin-analytics-dashboard.md) for the admin
page shell + access control; the library's CRUD UI lives inside that same
`/admin` page as a second section/tab.

## Relevant current state

- **Exercises aren't a first-class concept anywhere.** `Workout.exercises`
  ([backend/models.py:17](../backend/models.py)) is a JSONB blob — an arbitrary
  tree of `{type, name, duration/count, instruction, ...}` objects (nested
  `loop` types included), validated on the way in by `ParsedExercise` /
  `WorkoutParsed` in [backend/schemas.py](../backend/schemas.py). There is no
  exercises table, no foreign key from an exercise to anything — `name` is
  free text, however the user (or the LLM parser) typed it.
- **There's already a tiny hardcoded exercise list on the frontend**:
  `PRESET_EXERCISES` in [frontend/src/types/workout.ts:61](../frontend/src/types/workout.ts)
  — 11 entries used for quick-add buttons in the config UI. Worth treating as
  seed data / prior art, and possibly retiring once the real library exists.
- **Workout parsing already goes through an LLM** (`gpt-5.4-nano`, see
  [backend/routes/ai.py](../backend/routes/ai.py)), so exercise names in the
  database are whatever free text a user typed *or* whatever name the model
  chose to extract — there's already real-world spelling/wording variance to
  handle, not a hypothetical.
- **OpenAI's Python client is already a backend dependency** (`openai>=1.50.0`
  in [backend/requirements.txt](../backend/requirements.txt)), so an embeddings
  call is just a new method call on the existing client, not a new integration.
- **Schema changes go through Alembic**, introduced as a prerequisite in
  [Plan 1](01-admin-analytics-dashboard.md#prerequisite-introduce-alembic).
  This plan's new tables are ordinary migrations, same as everything else —
  not something relying on `create_all`'s "create whatever's missing" behavior.

## Data model

New table, `backend/models.py`:

```
Exercise
  id            UUID pk
  name          str            # canonical display name, e.g. "Sit-ups"
  aliases       JSONB[str]     # ["situps", "sit up", "crunches"?]  — admin-editable
  description   text, nullable
  video_url     str, nullable  # YouTube link etc.
  embedding     JSONB[float]   # embedding of "name + aliases", see below
  created_at / updated_at
```

`embedding` as JSONB-of-floats rather than a `vector` column — see the matching
architecture decision below.

A second, smaller table makes the "unmatched terms" admin workflow (below)
useful instead of theoretical:

```
UnmatchedExerciseTerm
  id            UUID pk
  raw_name      str            # normalized text that failed to match
  seen_count    int            # bumped each time it recurs
  last_seen_at  datetime
  resolved      bool default False
```

## Matching architecture

Options considered:

- **pgvector** (real vector column + ivfflat/hnsw index in Postgres) — the
  "proper" vector-search answer, but it needs to be *compiled into* the
  Postgres image, not just enabled with `CREATE EXTENSION`. Railway's default
  managed Postgres plugin doesn't ship it, so this means provisioning a
  different database image. Real operational cost, and it only pays off at a
  catalog size (thousands+) this app has no path to reaching.
- **Hosted vector DB** (Pinecone/Weaviate/Qdrant/etc.) — a new vendor, new API
  key, new failure mode, for a corpus that comfortably fits in memory. Not
  worth it here.
- **Brute-force cosine similarity in Python**, embeddings stored as JSONB
  floats — a loop over a few hundred vectors held in memory is
  sub-millisecond. No new extension, no new column type, no new service.
  Swappable for pgvector later without an API change if the library ever grows
  into the thousands.
- **pg_trgm (Postgres trigram similarity)** — not a vector-search option at
  all, but worth adding as its own tier: a standard Postgres *contrib*
  extension that ships in the normal `postgres` image (unlike pgvector), so
  `CREATE EXTENSION pg_trgm` just works via an Alembic migration. It does
  fuzzy *string* matching — exactly the "spelled a little differently" case
  (`situps` / `sit ups` / `sit-ups`) — for free, with no API call and no
  embedding involved at all.

**Decision: brute-force cosine similarity for embeddings (no pgvector, no
hosted vector DB), plus pg_trgm as a fast, free middle tier.** Reasoning:
trigram similarity handles spelling/spacing/punctuation variance — the case
you described first — instantly and without spending an OpenAI call; the
embedding fallback is reserved for genuine wording/synonym differences
trigram can't catch (e.g. "crunches" vs. "sit ups").

**Matching pipeline** (for a given raw exercise name):

1. Normalize: lowercase, strip punctuation/whitespace.
2. **Exact/alias match** against `name` and `aliases` (case-insensitive) —
   cheap, deterministic, handles exact re-typing instantly.
3. **Trigram fuzzy match** (`pg_trgm`'s `similarity()`/`%` operator) against
   `name` and `aliases` — catches spelling/spacing/punctuation variants
   without an API call. Threshold ~0.4–0.5 (pg_trgm's default-ish range; tune
   once there's real data).
4. **Embedding similarity fallback**: embed the raw name (OpenAI
   `text-embedding-3-small`), cosine-compare in Python against every
   `Exercise.embedding`, take the best match if it clears a confidence
   threshold (~0.80, tune once there's real data).
5. No match above threshold at any tier → log/bump an `UnmatchedExerciseTerm`
   row, return "no match" to the caller (no icon shown).
6. Cache the result (raw normalized name → matched id + score, or null; see
   caching below) — the same misspelling will recur across many workouts and
   there's no reason to redo tiers 2–4 every time someone parses a workout
   containing it, and no reason to re-embed something we've already embedded.

Canonical-side embeddings (`Exercise.embedding`) are computed once, at admin
write time (create/edit a library entry or its aliases) — not per request.

## When matching happens

**Decision: on-demand, and explicitly non-blocking.** A batch endpoint the
frontend calls once per screen-load with all the exercise names currently in
the workout — not matched once at creation/parse time and persisted — because:
- Library edits/additions retroactively improve matches for *existing*
  workouts (including ones shared via permalink, which can be viewed long after
  creation).
- The unmatched-terms queue reflects current reality, not a snapshot from
  whenever the workout happened to be created.

`POST /api/exercises/match`
```
{ "names": ["sit ups", "Plank", "burpees!!"] }
→ {
    "sit ups": { "exercise_id": "...", "name": "Sit-ups", "confidence": 1.0 },
    "Plank":   { "exercise_id": "...", "name": "Plank", "confidence": 1.0 },
    "burpees!!": null
  }
```
No auth required (same trust level as `GET /api/workouts` — read-only, public).

**Non-blocking on the frontend**: the exercise list renders immediately with
no icons, using only local data already in hand. The match call fires after
initial paint (e.g. from a `useEffect` that runs once the list is mounted) and
icons pop in as the batch response resolves. The match call is never on the
critical path for showing/starting a workout — worst case (slow network, API
hiccup) is just "icons never appear," never a delayed or blocked screen.

**Caching, two layers**:
- *Server-side*, keyed by normalized exercise name → match result (id/score or
  null). Shared across all users/workouts, since the same exercise name
  recurs constantly. This is what makes tiers 3–4 of the matching pipeline
  cheap in aggregate even though any single lookup does real work.
- *Client-side*, a lightweight in-memory cache (e.g. a module-level `Map`, or
  a small hook) scoped to the session — avoids re-fetching matches for
  exercise names already resolved earlier in the same visit (e.g. flipping
  between config and workout mode, or editing a workout).

## Admin CRUD (lives inside the Plan 1 `/admin` page)

- List/search canonical exercises
- Create/edit: name, aliases (tag input), description, video URL — re-embed on
  name/alias change
- Delete
- **Unmatched-terms review queue**: shows `UnmatchedExerciseTerm` rows sorted by
  `seen_count` desc, with a one-click "map to existing exercise as a new alias"
  or "create new exercise from this term" action. This is what makes the whole
  system self-improving instead of a one-time seed that goes stale — every gap
  the matcher hits becomes a visible, actionable admin task.

## Frontend: the info icon

- Small "ⓘ" next to the exercise name in `ConfigurationMode`'s exercise list
  rows only ([frontend/src/components/ConfigurationMode/ExerciseListView.tsx](../frontend/src/components/ConfigurationMode/ExerciseListView.tsx) /
  `ExerciseList.tsx`) — not in `WorkoutMode`. Decided: Workout Mode's
  full-screen timer UI stays uncluttered; the config screen is where users
  have time to tap and read before starting.
- On tap: popover/small modal with description + embedded video (YouTube
  iframe, or thumbnail-link if we want to avoid embedding third-party iframes).
- One batch call to `/api/exercises/match` per workout when entering config
  mode, fired non-blocking after initial render (see "When matching happens"
  above); result kept in component state, no per-exercise network calls.
- No match → no icon, no error state, silently absent.

## Seeding the initial library

Recommend a one-off `backend/scripts/seed_exercises.py` seeded with a curated
list of ~40-60 common exercises (can start from `PRESET_EXERCISES` in
`workout.ts` and expand), run once against prod after the table exists. Not
worth building an "import" UI for a one-time task.

## Non-goals for v1

- No exercise categories/muscle-group tagging (natural extension later, not
  needed for the info-icon feature itself)
- No feeding matched exercises back into the LLM parsing prompt (a plausible
  future RAG/few-shot improvement, but a separate project from "show an info
  icon")
- No public-facing exercise library browse page — admin-managed, user-consumed
  only via the info icon

## Suggested sequencing

1. `Exercise` + `UnmatchedExerciseTerm` tables via Alembic migration, seed script
2. Matching pipeline (exact/alias → pg_trgm → embedding fallback, server-side
   cache), `/api/exercises/match`
3. Admin CRUD for the library (needs Plan 1's admin shell)
4. Info icon in Configuration Mode, non-blocking fetch + client-side cache
5. Unmatched-terms review queue in admin

## Open questions

Resolved: matching uses brute-force embeddings + pg_trgm (no pgvector, no
hosted vector DB), matching happens on-demand and non-blocking with server-
and client-side caching, and the info icon is Configuration Mode only.
Nothing else here is currently blocking.
