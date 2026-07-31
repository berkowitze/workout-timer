import os
import uuid as uuid_module
from datetime import datetime, timedelta
from typing import Any

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from models import Exercise, UnmatchedExerciseTerm, User, Workout, WorkoutAttempt
from routes.auth import require_admin
from services.exercise_matching import embed_text, embedding_input, invalidate_cache

admin_bp = Blueprint("admin", __name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TIMESERIES_METRICS: dict[str, tuple[Any, Any]] = {
    "signups": (User, User.created_at),
    "workouts": (Workout, Workout.created_at),
    "attempts": (WorkoutAttempt, WorkoutAttempt.started_at),
}

PROGRESS_BUCKETS = 10  # decile buckets: 0-10%, 10-20%, ..., 90-100%


def _volume_counts(db: Any, model: Any, timestamp_col: Any, *extra_filters: Any) -> dict[str, int]:
    now = datetime.utcnow()
    base = db.query(func.count(model.id)).filter(*extra_filters)
    total = base.scalar()
    last_7d = base.filter(timestamp_col >= now - timedelta(days=7)).scalar()
    last_30d = base.filter(timestamp_col >= now - timedelta(days=30)).scalar()
    return {"total": total, "last_7d": last_7d, "last_30d": last_30d}


@admin_bp.route("/admin/summary", methods=["GET"])
@require_admin
def summary() -> Response:
    db = SessionLocal()
    try:
        volume = {
            # Private rows auto-created behind ad-hoc runs (see /attempts)
            # don't count as "workouts" here - this is a content metric.
            "workouts": _volume_counts(
                db, Workout, Workout.created_at, Workout.is_shared.is_(True)
            ),
            "users": _volume_counts(db, User, User.created_at),
            "attempts": _volume_counts(db, WorkoutAttempt, WorkoutAttempt.started_at),
        }

        total_attempts = volume["attempts"]["total"]
        completed_attempts = (
            db.query(func.count(WorkoutAttempt.id))
            .filter(WorkoutAttempt.status == "completed")
            .scalar()
        )
        completion_rate = (completed_attempts / total_attempts) if total_attempts else None

        progress_distribution = _progress_distribution(db)
        duration_comparison = _duration_comparison(db)

        authenticated_attempts = (
            db.query(func.count(WorkoutAttempt.id))
            .filter(WorkoutAttempt.user_id.isnot(None))
            .scalar()
        )
        guest_attempts = total_attempts - authenticated_attempts
        saved_attempts = (
            db.query(func.count(WorkoutAttempt.id))
            .join(Workout, Workout.id == WorkoutAttempt.workout_id)
            .filter(Workout.is_shared.is_(True))
            .scalar()
        )
        ad_hoc_attempts = total_attempts - saved_attempts
        returning_guests = (
            db.query(WorkoutAttempt.anonymous_id)
            .filter(WorkoutAttempt.anonymous_id.isnot(None))
            .group_by(WorkoutAttempt.anonymous_id)
            .having(func.count(WorkoutAttempt.id) > 1)
            .count()
        )

        return jsonify(
            {
                "volume": volume,
                "completion_rate": completion_rate,
                "progress_distribution": progress_distribution,
                "duration_comparison": duration_comparison,
                "audience": {
                    "authenticated_attempts": authenticated_attempts,
                    "guest_attempts": guest_attempts,
                    "returning_guests": returning_guests,
                    "saved_attempts": saved_attempts,
                    "ad_hoc_attempts": ad_hoc_attempts,
                },
            }
        )
    finally:
        db.close()


def _progress_distribution(db: Any) -> list[dict[str, Any]]:
    """Bucket exercises_completed/total_exercises into deciles, so a cliff at a
    specific point in a workout is visible rather than averaged away."""
    rows = (
        db.query(WorkoutAttempt.exercises_completed, WorkoutAttempt.total_exercises)
        .filter(WorkoutAttempt.total_exercises > 0)
        .all()
    )

    counts = [0] * PROGRESS_BUCKETS
    for exercises_completed, total_exercises in rows:
        fraction = min(exercises_completed / total_exercises, 1.0)
        bucket = min(int(fraction * PROGRESS_BUCKETS), PROGRESS_BUCKETS - 1)
        counts[bucket] += 1

    return [
        {"bucket": f"{i * 10}-{(i + 1) * 10}%", "count": counts[i]} for i in range(PROGRESS_BUCKETS)
    ]


def _duration_comparison(db: Any) -> dict[str, Any]:
    """Actual vs. expected duration for attempts that recorded both - a rough
    sanity check on whether people run workouts at the pace we predict."""
    rows = (
        db.query(WorkoutAttempt.duration_seconds, WorkoutAttempt.expected_duration_seconds)
        .filter(
            WorkoutAttempt.duration_seconds.isnot(None),
            WorkoutAttempt.expected_duration_seconds.isnot(None),
            WorkoutAttempt.expected_duration_seconds > 0,
        )
        .all()
    )

    sample_count = len(rows)
    if sample_count == 0:
        return {
            "sample_count": 0,
            "avg_actual_seconds": None,
            "avg_expected_seconds": None,
            "avg_ratio": None,
        }

    avg_actual = sum(actual for actual, _ in rows) / sample_count
    avg_expected = sum(expected for _, expected in rows) / sample_count
    avg_ratio = sum(actual / expected for actual, expected in rows) / sample_count

    return {
        "sample_count": sample_count,
        "avg_actual_seconds": round(avg_actual, 1),
        "avg_expected_seconds": round(avg_expected, 1),
        "avg_ratio": round(avg_ratio, 3),
    }


@admin_bp.route("/admin/timeseries", methods=["GET"])
@require_admin
def timeseries() -> tuple[Response, int] | Response:
    metric = request.args.get("metric", "")
    if metric not in TIMESERIES_METRICS:
        return jsonify({"error": f"metric must be one of {sorted(TIMESERIES_METRICS)}"}), 400

    try:
        days = int(request.args.get("days", 30))
    except ValueError:
        return jsonify({"error": "days must be an integer"}), 400
    days = max(1, min(days, 365))

    model, timestamp_col = TIMESERIES_METRICS[metric]

    start = datetime.utcnow().date() - timedelta(days=days - 1)
    db = SessionLocal()
    try:
        query = db.query(func.date(timestamp_col).label("day"), func.count(model.id)).filter(
            timestamp_col >= start
        )
        if metric == "workouts":
            # Same content-metric reasoning as volume.workouts: exclude
            # private rows auto-created behind ad-hoc runs.
            query = query.filter(Workout.is_shared.is_(True))
        rows = query.group_by("day").all()
        counts_by_day = {day.isoformat(): count for day, count in rows}

        series = []
        for offset in range(days):
            day = (start + timedelta(days=offset)).isoformat()
            series.append({"date": day, "count": counts_by_day.get(day, 0)})

        return jsonify(series)
    finally:
        db.close()


@admin_bp.route("/admin/workouts", methods=["GET"])
@require_admin
def list_workouts() -> tuple[Response, int] | Response:
    sort = request.args.get("sort", "recent")
    if sort not in ("popularity", "recent"):
        return jsonify({"error": "sort must be 'popularity' or 'recent'"}), 400

    try:
        limit = int(request.args.get("limit", 50))
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400
    limit = max(1, min(limit, 200))

    db = SessionLocal()
    try:
        attempt_count = func.count(WorkoutAttempt.id).label("attempt_count")
        query = (
            db.query(Workout, attempt_count)
            .outerjoin(WorkoutAttempt, WorkoutAttempt.workout_id == Workout.id)
            .filter(Workout.is_shared.is_(True))
            .group_by(Workout.id)
        )
        query = (
            query.order_by(attempt_count.desc(), Workout.created_at.desc())
            if sort == "popularity"
            else query.order_by(Workout.created_at.desc())
        )
        rows = query.limit(limit).all()

        return jsonify(
            [
                {
                    "id": str(workout.id),
                    "name": workout.name,
                    "created_at": workout.created_at.isoformat() if workout.created_at else None,
                    "attempt_count": count,
                }
                for workout, count in rows
            ]
        )
    finally:
        db.close()


@admin_bp.route("/admin/workouts/<workout_id>/attempts", methods=["GET"])
@require_admin
def workout_attempts(workout_id: str) -> tuple[Response, int] | Response:
    try:
        workout_uuid = uuid_module.UUID(workout_id)
    except ValueError:
        return jsonify({"error": "Invalid workout ID"}), 400

    db = SessionLocal()
    try:
        workout = db.query(Workout).filter(Workout.id == workout_uuid).first()
        if not workout:
            return jsonify({"error": "Workout not found"}), 404

        rows = (
            db.query(WorkoutAttempt, User.email)
            .outerjoin(User, User.id == WorkoutAttempt.user_id)
            .filter(WorkoutAttempt.workout_id == workout_uuid)
            .order_by(WorkoutAttempt.started_at.desc())
            .all()
        )

        attempts = []
        for attempt, user_email in rows:
            attempt_dict = attempt.to_dict()
            attempt_dict["user_email"] = user_email
            attempts.append(attempt_dict)

        return jsonify(attempts)
    finally:
        db.close()


def _clean_aliases(raw: Any) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list) or not all(isinstance(a, str) for a in raw):
        raise ValueError("aliases must be a list of strings")
    cleaned = []
    seen = set()
    for alias in raw:
        alias = alias.strip()
        if alias and alias.lower() not in seen:
            seen.add(alias.lower())
            cleaned.append(alias)
    return cleaned


@admin_bp.route("/admin/exercises", methods=["GET"])
@require_admin
def list_exercises() -> Response:
    search = request.args.get("search", "").strip().lower()
    db = SessionLocal()
    try:
        exercises = db.query(Exercise).order_by(Exercise.name).all()
        if search:

            def matches(ex: Exercise) -> bool:
                haystack = [ex.name, *(ex.aliases or [])]
                return any(search in h.lower() for h in haystack)

            exercises = [ex for ex in exercises if matches(ex)]
        return jsonify([ex.to_dict() for ex in exercises])
    finally:
        db.close()


@admin_bp.route("/admin/exercises", methods=["POST"])
@require_admin
def create_exercise() -> tuple[Response, int] | Response:
    data: dict[str, Any] = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    try:
        aliases = _clean_aliases(data.get("aliases"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db = SessionLocal()
    try:
        exercise = Exercise(
            name=name,
            aliases=aliases,
            description=data.get("description") or None,
            video_url=data.get("video_url") or None,
            needs_equipment=bool(data.get("needs_equipment", False)),
            embedding=embed_text(embedding_input(name, aliases)),
        )
        db.add(exercise)
        db.commit()
        db.refresh(exercise)
        invalidate_cache()
        return jsonify(exercise.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@admin_bp.route("/admin/exercises/<exercise_id>", methods=["PUT"])
@require_admin
def update_exercise(exercise_id: str) -> tuple[Response, int] | Response:
    try:
        exercise_uuid = uuid_module.UUID(exercise_id)
    except ValueError:
        return jsonify({"error": "Invalid exercise ID"}), 400

    data: dict[str, Any] = request.get_json() or {}

    db = SessionLocal()
    try:
        exercise = db.query(Exercise).filter(Exercise.id == exercise_uuid).first()
        if not exercise:
            return jsonify({"error": "Exercise not found"}), 404

        name = str(data.get("name") if data.get("name") is not None else exercise.name).strip()
        if not name:
            return jsonify({"error": "name is required"}), 400

        try:
            raw_aliases = data.get("aliases") if "aliases" in data else exercise.aliases
            aliases = _clean_aliases(raw_aliases)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        needs_re_embed = name != exercise.name or aliases != (exercise.aliases or [])

        exercise.name = name
        exercise.aliases = aliases
        if "description" in data:
            exercise.description = data.get("description") or None
        if "video_url" in data:
            exercise.video_url = data.get("video_url") or None
        if "needs_equipment" in data:
            exercise.needs_equipment = bool(data.get("needs_equipment"))

        if needs_re_embed:
            exercise.embedding = embed_text(embedding_input(name, aliases))

        db.commit()
        db.refresh(exercise)
        invalidate_cache()
        return jsonify(exercise.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@admin_bp.route("/admin/exercises/<exercise_id>", methods=["DELETE"])
@require_admin
def delete_exercise(exercise_id: str) -> tuple[Response, int] | Response:
    try:
        exercise_uuid = uuid_module.UUID(exercise_id)
    except ValueError:
        return jsonify({"error": "Invalid exercise ID"}), 400

    db = SessionLocal()
    try:
        exercise = db.query(Exercise).filter(Exercise.id == exercise_uuid).first()
        if not exercise:
            return jsonify({"error": "Exercise not found"}), 404
        db.delete(exercise)
        db.commit()
        invalidate_cache()
        return Response(status=204)
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@admin_bp.route("/admin/exercises/unmatched", methods=["GET"])
@require_admin
def list_unmatched_terms() -> Response:
    show_resolved = request.args.get("resolved", "false").lower() == "true"
    db = SessionLocal()
    try:
        terms = (
            db.query(UnmatchedExerciseTerm)
            .filter(UnmatchedExerciseTerm.resolved == show_resolved)
            .order_by(UnmatchedExerciseTerm.seen_count.desc())
            .all()
        )
        return jsonify([term.to_dict() for term in terms])
    finally:
        db.close()


@admin_bp.route("/admin/exercises/unmatched/<term_id>/resolve", methods=["POST"])
@require_admin
def resolve_unmatched_term(term_id: str) -> tuple[Response, int] | Response:
    try:
        term_uuid = uuid_module.UUID(term_id)
    except ValueError:
        return jsonify({"error": "Invalid term ID"}), 400

    data: dict[str, Any] = request.get_json() or {}
    action = data.get("action")
    if action not in ("alias", "create"):
        return jsonify({"error": "action must be 'alias' or 'create'"}), 400

    db = SessionLocal()
    try:
        term = (
            db.query(UnmatchedExerciseTerm).filter(UnmatchedExerciseTerm.id == term_uuid).first()
        )
        if not term:
            return jsonify({"error": "Unmatched term not found"}), 404

        if action == "alias":
            try:
                exercise_uuid = uuid_module.UUID(data.get("exercise_id"))
            except (TypeError, ValueError):
                return jsonify({"error": "exercise_id is required and must be a valid ID"}), 400

            exercise = db.query(Exercise).filter(Exercise.id == exercise_uuid).first()
            if not exercise:
                return jsonify({"error": "Exercise not found"}), 404

            aliases = list(exercise.aliases or [])
            if term.raw_name not in aliases:
                aliases.append(str(term.raw_name))
                exercise.aliases = aliases
                exercise.embedding = embed_text(embedding_input(str(exercise.name), aliases))

            term.resolved = True
            db.commit()
            db.refresh(exercise)
            invalidate_cache()
            return jsonify(exercise.to_dict())

        # action == "create"
        name = (data.get("name") or term.raw_name).strip()
        if not name:
            return jsonify({"error": "name is required"}), 400

        try:
            aliases = _clean_aliases(data.get("aliases"))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        if term.raw_name != name and term.raw_name not in aliases:
            aliases.append(str(term.raw_name))

        exercise = Exercise(
            name=name,
            aliases=aliases,
            description=data.get("description") or None,
            video_url=data.get("video_url") or None,
            needs_equipment=bool(data.get("needs_equipment", False)),
            embedding=embed_text(embedding_input(name, aliases)),
        )
        db.add(exercise)
        term.resolved = True
        db.commit()
        db.refresh(exercise)
        invalidate_cache()
        return jsonify(exercise.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
