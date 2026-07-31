# Plan 3: Workout Library Browser (Search, Filter, Popularity Sort)

## Goal

Replace the current flat `<select>` dropdown for loading a saved workout with a
dedicated, paginated browse page — sorted by popularity by default, filterable
by duration / body focus / equipment, searchable by name, and with a
natural-language search bar that fills in those same filters rather than
searching on its own path. Manual filters are the permanent, primary
interface; the NL bar is a convenience layer on top of them, never a
replacement.

This is a proposal doc, not a finalized plan like [Plan 1](01-admin-analytics-dashboard.md)
or [Plan 2](02-exercise-library-matching.md) — several sections below present
options rather than a single decision, for you to weigh in on before
implementation starts (see "Open questions for you").

## Relevant current state

- **`Workout` has almost no metadata.** [backend/models.py:12-18](../backend/models.py) —
  only `id`, `name`, `exercises` (a JSONB blob, arbitrary nested tree), and
  `created_at`. No `description`, `duration`, `equipment`, or `tags` columns
  exist anywhere today.
- **Duration isn't stored per-workout at all.** It only exists per-*attempt*,
  as `WorkoutAttempt.expected_duration_seconds` ([backend/models.py:54](../backend/models.py)),
  and even there it's `null` whenever the workout has any rep-based exercise
  (no fixed expected length). "Filter by duration" has no column to filter on
  yet.
- **`GET /workouts` has zero query-param support.** [backend/routes/workouts.py:23-30](../backend/routes/workouts.py) —
  fixed `created_at desc` order, no filtering, no pagination, returns the
  entire table every call. Fine for a dropdown that loads on open; not fine as
  the backing endpoint for a public browse page, especially as the table
  grows — which is exactly why you want a separate page whose data doesn't
  load until visited.
- **Popularity sort already exists, but only inside Plan 1's admin surface.**
  [backend/routes/admin.py:186-226](../backend/routes/admin.py) — `GET
  /admin/workouts?sort=popularity` computes it live via `outerjoin(WorkoutAttempt)
  + group_by(Workout.id) + func.count(...)`, ordering by `attempt_count desc,
  created_at desc`. It's not a stored counter, and today it's gated behind
  `require_admin`. This feature makes that same computation public for the
  first time — the aggregation logic should be factored into a shared helper
  both `admin.py` and the new public route call, not duplicated.
- **No router; pathname-check precedent.** `App.tsx` hand-rolls an `AppMode`
  state machine plus one pathname regex for `/w/:id` share links (per Plan
  1's notes). A new browse page follows the same pattern: another pathname
  check, another `AppMode` — no new dependency needed.
- **Plan 2's `Exercise` table is exercise-level, not workout-level**, and
  explicitly rules out a public browse page as a non-goal for *that* plan (its
  info-icon is Configuration-Mode-only). So there's no direct overlap with
  this plan's workout-level tags/equipment — but once Plan 2 lands, an
  exercise's canonical equipment ("needs a pull-up bar") could become a better
  source of truth than an LLM re-guessing equipment per workout. Worth
  revisiting once Plan 2 ships; not a blocker for v1 of this plan.
- **The LLM pattern to reuse already exists**, just not via OpenAI's native
  structured-output/JSON-schema feature — it's plain-text completion +
  manual `json.loads` + Pydantic validation (`WorkoutParsed.model_validate`)
  + a code-level semantic check (`_check_semantics`) + a feed-the-error-back
  retry loop, capped at `MAX_RETRIES = 2` ([backend/routes/ai.py:36-77](../backend/routes/ai.py)).
  `parse-workout` runs this on `gpt-5.4-nano`; `generate-name` is a second,
  simpler LLM call on `gpt-4o-mini` ([backend/routes/ai.py:83-107](../backend/routes/ai.py)).
  Both the auto-tagging feature and the NL-to-filters feature below are
  natural third/fourth uses of this same pattern.
- **No full-text/fuzzy search infra anywhere** — no `pg_trgm`, no external
  search service. Plan 2 is separately considering enabling `pg_trgm` for
  exercise-name matching; if this plan also wants it, it's the same
  `CREATE EXTENSION pg_trgm` migration either plan can land once.
- Every route module (`workouts.py`, `admin.py`, `attempts.py`) makes its own
  `engine`/`SessionLocal` instead of sharing `app.py`'s — an existing
  inconsistency, not this plan's problem to fix, but worth following that
  same per-module pattern rather than inventing a third convention.

## Already decided (per your steer — not up for debate below)

- Separate page, not a dropdown — so the data set doesn't load unless the
  page is visited.
- Paginated.
- Searchable by name.
- Sorted by popularity by default (this is the whole reason
  `WorkoutAttempt` was added in commit `755952f` ahead of having a consumer).
- Manual filters are first-class and permanent — duration, body
  focus/workout type (legs/arms/abs/etc.), equipment needed, at minimum.
- A natural-language search bar is additive: it parses free text into the
  *same* filter state the manual controls edit. It never bypasses or
  supersedes manual filtering.
- Open to being creative with AI-generated tags/descriptions per workout.

## Open decisions — options

### A. Where does "duration" come from?

- **A1 — Compute at write time, store denormalized.** On create/edit
  (`POST /workouts`, and any future edit endpoint), estimate a workout's
  duration from its exercise tree (sum timed durations, apply a fixed
  per-rep estimate for numeric exercises so every workout gets a real number,
  never null) and store it as a plain `estimated_duration_seconds` column.
  Filtering/sorting by duration becomes an ordinary indexed-column query.
- **A2 — Compute on read, filter in Python.** No migration, but duration
  filtering/sorting can't be pushed into SQL against a JSONB blob — you'd
  fetch rows, compute duration in the app, and filter there, which breaks
  clean pagination (you don't know how many rows match until you've computed
  all of them).
- **Recommendation: A1.** Small, single Alembic migration (same convention
  Plan 1 and Plan 2 already use for every schema change), and it's the only
  option where duration participates in real SQL pagination/sorting instead
  of loading the whole table to filter in-process.

### B. Tags & equipment: schema shape

- **B1 — Normalized `Tag` + `WorkoutTag` many-to-many.** Tags are real rows
  (`id`, `name`, `category`), joined to workouts. Enables autocomplete, a
  canonical no-duplicates tag list, and admin curation later (a natural third
  tab in Plan 1's admin shell). Most schema/query work of the three options.
- **B2 — Freeform `tags: JSONB[str]` directly on `Workout`.** One column, one
  migration, simplest to ship — but nothing stops the AI from tagging one
  workout "legs" and another "leg day," which won't group together in a
  filter UI.
- **B3 — Hybrid: JSONB array, but LLM output constrained to a fixed enum.**
  Same simplicity as B2 (no join table), but the tag values are defined as a
  Python enum (e.g. body-focus: `legs/arms/core/back/full-body/cardio`;
  equipment: `none/dumbbells/bench/pull-up-bar/bands`), and the LLM's output
  is validated against that enum the same way `ParsedExercise` is validated
  today — so results can't drift into duplicate near-synonyms. Adding a new
  tag value is a code change, not an admin action.
- **Recommendation: B3 for v1.** Filterable, non-drifting tags without
  building a join table or an admin curation UI in the same pass. Upgrades
  cleanly to B1 later if you want free-form/admin-curated tags (migrate enum
  values into real `Tag` rows).

### C. When does AI tagging/description-generation run?

- **C1 — At creation/edit time**, folded into the existing `parse-workout`
  call (extend `WorkoutParsed`'s schema to also return `tags` +
  a short `description` in the same response that already parses the
  exercise tree — one LLM round-trip, not two). Every new workout is tagged
  immediately. Existing workouts still need a one-off backfill script
  regardless (they predate this feature).
- **C2 — Async/backfill batch job**, decoupled from creation — a script
  (same shape as Plan 2's proposed `seed_exercises.py`) that tags any
  untagged workout, re-runnable whenever the tag taxonomy changes. New
  workouts show with no tags until the next run.
- **Recommendation: C1**, folded into the existing `parse-workout` request —
  avoids a second LLM round trip and keeps workout creation a single atomic
  step. You'll still want a one-time backfill script for workouts that exist
  before this ships, independent of which option you pick.

### D. Search/filter backend approach

- **D1 — Plain SQL, no new extensions.** Name search via `ILIKE
  '%term%'`; duration/tag/equipment filters as ordinary column/JSONB-contains
  predicates; popularity sort reuses the `outerjoin(WorkoutAttempt) +
  count()` pattern already in `admin.py`, factored into a shared helper. Zero
  new infra. No typo tolerance or relevance ranking, but reasonable for a
  name search box at this scale.
- **D2 — Add `pg_trgm`.** The same extension Plan 2 is separately
  considering for exercise-name matching — worth landing once, for whichever
  plan needs it first, and having both use it. Gets typo-tolerant fuzzy name
  search (`similarity()`/`%` operator) with no per-search API cost.
- **D3 — Postgres full-text search (`tsvector`/`to_tsquery`)** over name +
  AI-generated description, with a GIN index. Better relevance ranking for
  longer description text than ILIKE, still stock Postgres, but more moving
  parts (generated column or app-side tsvector maintenance on every write)
  than D1/D2 justify at a small-to-moderate catalog size.
- **Recommendation: D1 now**, D2 (`pg_trgm`) as the first upgrade if ILIKE
  search feels too literal in practice — coordinated with Plan 2 so the
  extension is enabled once, by whichever plan lands it first.

### E. Natural-language search bar → filters

- **E1 — LLM extraction, same pattern as `parse-workout`.** New endpoint
  (e.g. `POST /api/workouts/parse-search`) takes free text ("10 minute
  workout, no equipment, legs") and returns a partial filter object (e.g.
  `{"duration_max_seconds": 600, "equipment": "none", "body_focus": "legs"}`)
  via `gpt-5.4-nano` (matching the existing cost-conscious precedent),
  validated against the same enum from Option B3. The frontend takes that
  response and **sets** the manual filter controls to match — filters stay
  the single source of truth; the NL bar is just another way to set them, so
  a user can type a phrase, watch filter chips populate, then keep adjusting
  by hand.
- **E2 — Client-side heuristic parsing** (regex for "N minute(s)", keyword
  lists for equipment/body-focus terms). Zero latency/cost, but brittle
  against real phrasing variance, and duplicates logic an LLM handles far
  more robustly. Not recommended given you specifically want this to feel
  like free text, not a constrained mini-syntax.
- **Recommendation: E1.** Directly matches your "AI populates filters,
  filters stay canonical" requirement, and it's a small, cheap addition to
  LLM infra that already exists.

### F. Pagination strategy

- **F1 — Offset-based** (`LIMIT`/`OFFSET`, page numbers). Simplest to
  implement and to show in a UI ("Page 3 of 12"). The known correctness
  wobble (rows shifting between page loads as new workouts are created) is a
  non-issue at this app's likely scale.
- **F2 — Keyset/cursor-based** (`WHERE (popularity, id) < (...)`). More
  correct under concurrent writes, scales better, but needs a distinct cursor
  shape per sort column and gives up page-number navigation.
- **Recommendation: F1.** Standard, simple, fine at this scale; revisit only
  if the library grows large enough for `OFFSET`'s linear-scan cost to matter.

## UI/UX — page layout options

### UX1 — Filter sidebar + card grid ("product catalog" pattern)

Left sidebar: NL search bar on top, manual filter groups below (duration as
preset buttons or a slider; body-focus and equipment as checkbox groups) —
always visible, always the same controls the NL bar fills in. Main area: a
grid of workout cards (name, AI description, tag chips, attempt-count/"🔥
popular" badge, duration), sorted by popularity by default with a
popularity/newest/name sort dropdown. Pagination at the bottom. Good for
visual scanning; needs a new card-grid component with no precedent in this
codebase yet.

### UX2 — Top filter bar + dense list ("search results" pattern)

NL search bar full-width at top; filter chips/dropdowns in a row beneath it
(collapses better on mobile than a sidebar). Main area is a dense vertical
list (name, inline tags, duration, attempt count) — one row per workout,
closer to what `WorkoutSelector` already shows, just richer and paginated
instead of a dropdown.

- **Recommendation: UX2 for v1** — smaller lift, and it's the more direct
  evolution of the existing list-like presentation. It also matches the
  "hand-roll simple UI, no new dependency" precedent from Plan 1 (no
  charting/card-grid library exists in `frontend/package.json` today). UX1's
  card grid is a reasonable v2 visual upgrade once you know which filters
  people actually use.

## Backend sketch (assuming the recommendations above)

- `GET /api/workouts/library?q=&sort=popularity|recent|name&duration_max=&body_focus=&equipment=&page=&page_size=` —
  a new, distinct endpoint rather than adding params to `GET /workouts`,
  since that existing endpoint is also the plain "give me everything" call
  used elsewhere (e.g. wherever `WorkoutSelector` or share-link flows list
  workouts today) — mixing "everything" and "filtered/paginated/sorted page"
  concerns into one endpoint is messier than two purpose-built ones.
  Popularity computed via a shared helper factored out of
  `admin.py`'s existing `outerjoin(WorkoutAttempt) + count()` logic, imported
  by both routes instead of copy-pasted.
- `POST /api/workouts/parse-search` — NL text → partial filter object,
  `gpt-5.4-nano`, Pydantic-validated against the tag/equipment enum from B3.
- `Workout` gains (one Alembic migration): `estimated_duration_seconds`
  (int), `description` (text, nullable), `tags` (JSONB[str], values
  constrained at the app layer to the fixed enum per B3).
- `WorkoutParsed` (in `schemas.py`) gains `tags` + `description` fields so
  they're produced in the same `parse-workout` call that already parses the
  exercise tree (Option C1); one-off backfill script for pre-existing
  workouts, same shape as Plan 2's proposed `seed_exercises.py`.

## Non-goals for v1

- No admin-curated/free-form tag taxonomy (Option B1) — fixed enum only.
- No card-grid visual browsing (Option UX1) — dense list only.
- No relevance-ranked full-text search (Option D3) — plain `ILIKE`.
- No user editing of AI-assigned tags/description — AI-generated only; if the
  AI mistags a workout there's no v1 correction UI (see open questions).
- No saved searches or saved filter presets.

## Open questions for you

1. Confirm the enum-based tag approach (B3) is an acceptable trade — a new
   tag category later is a code change until/unless you migrate to a real
   `Tag` table (B1).
2. Do mistagged workouts need any v1 correction path (e.g. an edit-tags
   control), or is "wrong tag, live with it for now" acceptable for a first
   pass?
3. New `/api/workouts/library` endpoint vs. extending `GET /workouts` —
   any preference, given whatever else in the frontend already calls
   `GET /workouts` directly?
4. Confirm UX2 (dense list) over UX1 (card grid) for the v1 page layout.
5. Naming/route for the page itself (e.g. `/library`, `/browse`, `/workouts`)
   — whatever you'd want in the URL bar and nav.

## Suggested sequencing

1. `Workout` migration: `estimated_duration_seconds`, `description`, `tags`
   (Alembic, same convention as Plans 1–2).
2. Extend `parse-workout`'s schema + prompt to also emit description/tags
   (Option C1); one-off backfill script for existing workouts.
3. `GET /api/workouts/library` (search/filter/sort/paginate), factoring the
   popularity aggregation out of `admin.py` into a shared helper.
4. `POST /api/workouts/parse-search` (NL text → filters).
5. Frontend browse page (UX2 dense list): manual filters + NL bar wired to
   shared filter state, pagination controls, `AppMode` + pathname routing
   consistent with the existing `/w/:id` precedent.
6. v2 candidates, not v1: card-grid layout (UX1), free-form/admin-curated tag
   taxonomy (B1), correction UI for mistagged workouts, `pg_trgm` fuzzy
   search (D2).
