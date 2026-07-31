# Plan 1: Admin Analytics Dashboard

## Goal

A `/admin` page, visible only to you, showing how the app is being used: how many
workouts exist, how many users have signed up, how many workout attempts have
happened, and how far people get through them before dropping off.

## Relevant current state

- **No roles system exists at all.** `User` ([backend/models.py](../backend/models.py))
  has no `is_admin`/role column. `require_auth` ([backend/routes/auth.py](../backend/routes/auth.py))
  only checks "is this a valid JWT," not who the caller is.
- **No migrations today — and this plan requires fixing that first.** `init_db()`
  just calls `Base.metadata.create_all(bind=engine)`, run once per deploy before
  gunicorn starts ([Dockerfile:27](../Dockerfile)). This creates *missing tables*
  automatically but will **not** add a column to an existing table, which is
  exactly what an `is_admin` flag on `users` needs. Decision: bring in Alembic
  now rather than hand-rolling one more manual `ALTER TABLE` — see the new
  prerequisite section below. This also benefits Plan 2, whose new tables would
  otherwise keep relying on the same fragile `create_all` behavior.
- **The analytics data mostly already exists.** `WorkoutAttempt`
  ([backend/models.py:39](../backend/models.py)) already tracks `status`,
  `total_exercises`, `numeric_exercise_count`, `exercises_completed`,
  `expected_duration_seconds` / `duration_seconds`, `user_id` vs `anonymous_id`,
  and timestamps. This table was added specifically for future popularity/analytics
  use (see commit `755952f`), so Plan 1 is largely a matter of querying data that's
  already being collected, not adding new instrumentation.
- **No admin/internal routing today.** The frontend has no router — `App.tsx`
  hand-rolls a `mode` state machine and does one manual `pathname` regex check for
  shared-workout links (`/w/:id`). An admin page would follow the same pattern:
  another pathname check + another `AppMode`.
- **No charting library** is in `frontend/package.json`. The existing timer UI
  hand-rolls SVG (`TimerCircle.tsx`), so a first pass could do the same for a
  couple of simple bar/line visualizations rather than pulling in a dependency.

## Prerequisite: introduce Alembic

This has to land before the `is_admin` column, and unblocks Plan 2's schema
too. Steps:

1. Add `alembic` to `backend/requirements.txt`.
2. `alembic init migrations` inside `backend/`. Configure `migrations/env.py` to
   import `Base` from `models` (`target_metadata = Base.metadata`) and to read
   `DATABASE_URL` from the environment — reusing the same `postgres://` →
   `postgresql://` normalization that already exists in `app.py` — instead of a
   hardcoded URL in `alembic.ini`.
3. Generate a **baseline migration** from the current models:
   `alembic revision --autogenerate -m "baseline"`. This should autogenerate
   `CREATE TABLE` for `workouts`, `users`, `workout_attempts` — i.e. it
   describes the schema that's *already live*, it doesn't change it.
4. **One-time manual step, prod and any existing local dev DB**: run
   `alembic stamp head` (not `upgrade head`) against databases that already have
   these tables from `create_all`. Stamping tells Alembic "this migration is
   already applied" without re-running its DDL, which would otherwise fail on
   `CREATE TABLE` against tables that already exist. A genuinely fresh database
   (e.g. a new local dev DB) just runs `alembic upgrade head` normally.
5. **Wire it into deploy**: replace the Dockerfile's
   `python -c "from app import init_db; init_db()"` ([Dockerfile:27](../Dockerfile))
   with `alembic upgrade head`, still run at container start, immediately before
   gunicorn boots. This has to happen at deploy/runtime, not image-build time —
   `DATABASE_URL` and the live Postgres instance are only reachable once the
   container is actually running on Railway, not during the Docker build stage.
6. Retire `init_db()`/`create_all()` as the source of truth for schema — from
   here on, every schema change (including Plan 2's new tables) is a committed
   Alembic revision, reviewed like any other diff, not something that happens
   implicitly on deploy.
7. Local dev: use `backend/venv/bin/alembic` (per this repo's venv convention)
   to run `alembic upgrade head` after pulling migration changes.

## Access control: `is_admin` flag

With Alembic in place, this is now just a normal migration:
`Column("is_admin", Boolean, default=False)` on `User`, added via
`alembic revision --autogenerate -m "add is_admin to users"`. A new
`require_admin` decorator wraps `require_auth`, additionally checking
`User.is_admin` for the caller resolved from the JWT `sub`. You'll need to flip
your own row to `is_admin = true` manually once, post-migration (there's no
self-serve admin-grant UI in v1).

The check happens twice: server-side (every `/api/admin/*` route — this is the
actual security boundary) and client-side (hide the `/admin` route/nav entry
for non-admins, purely for UX, since the real enforcement is the server check).

## Backend

New `backend/routes/admin.py`, registered at `/api/admin`, every route wrapped in
`require_admin`:

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/summary` | Headline counts + rates (see Metrics below) |
| `GET /api/admin/timeseries?metric=signups\|workouts\|attempts&days=30` | Daily counts for trend charts |
| `GET /api/admin/workouts?sort=popularity\|recent&limit=50` | Workout list with attempt counts, for a "top workouts" table |
| `GET /api/admin/workouts/<id>/attempts` | Drill-down: all attempts for one workout |

All of these are read-only aggregate SQL over existing tables — no new tables
required for Plan 1 itself (independent of the access-control decision above).

## Metrics to surface

**Volume**
- Total workouts, total users, total attempts (all-time + last 7/30 days)

**Engagement / funnel**
- Completion rate: `status = 'completed'` ÷ total attempts
- Progress distribution: `exercises_completed / total_exercises` histogram, so you
  can see *where* people bail (e.g. a cliff at exercise 2 of 8 is very different
  from an even drop-off)
- Actual vs. expected duration (`duration_seconds` vs `expected_duration_seconds`)
  for attempts that have both, as a rough "do people run it at the pace we predict"
  sanity check

**Growth**
- Signups/day, workouts created/day, attempts/day — last 30 days, line chart

**Audience**
- Authenticated vs. guest attempts (`user_id` vs `anonymous_id`)
- Returning guests: distinct `anonymous_id` values with >1 attempt (a proxy for
  guest retention, since guests have no account to key off of)

**Content**
- Top workouts by attempt count (this is the "popularity" signal the July 31
  attempt-tracking commit was laying groundwork for — the admin page becomes its
  first consumer, ahead of any public-facing "popular workouts" sort)
- Most recently created workouts

## Frontend

- New `AppMode = "admin"`, reached via a pathname check (`/admin`) alongside the
  existing `/w/:id` check in `App.tsx`, consistent with how shared-workout
  routing already works.
- New `frontend/src/components/Admin/` directory: a dashboard shell + a handful
  of stat-tile / simple-chart components. Start dependency-free (custom SVG, like
  `TimerCircle`); revisit a charting library only if the hand-rolled charts get
  unwieldy.
- Client-side gate: if not authenticated or not admin, redirect to `/`. (Actual
  enforcement is server-side; this is just to avoid flashing an empty dashboard.)

## Non-goals for v1

- No CSV/data export
- No date-range picker (fixed windows: all-time, 7d, 30d)
- No per-user PII drill-down beyond email + counts
- No editing/moderation of workouts from this page (that's arguably a separate
  "content moderation" feature, not analytics)

## Suggested sequencing

1. Install + wire up Alembic (baseline migration, `stamp head` on prod, deploy
   `CMD` change)
2. `is_admin` migration + `require_admin` decorator + `/api/admin/summary`
   (headline numbers only)
3. Admin page shell in frontend showing summary stat tiles
4. Timeseries + funnel endpoints and charts
5. Top-workouts table with drill-down

## Open questions

Resolved: access control is a DB `is_admin` flag, with Alembic introduced as a
prerequisite (see above). Nothing else here is currently blocking — everything
has a default chosen above (metrics list, non-goals, sequencing). Flag if any
of those defaults are wrong before implementation starts.
