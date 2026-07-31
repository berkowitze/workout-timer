import os
import uuid as uuid_module
from datetime import datetime, timedelta
from typing import Any

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from models import User, Workout, WorkoutAttempt
from routes.auth import require_admin

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


def _volume_counts(db: Any, model: Any, timestamp_col: Any) -> dict[str, int]:
    now = datetime.utcnow()
    total = db.query(func.count(model.id)).scalar()
    last_7d = (
        db.query(func.count(model.id)).filter(timestamp_col >= now - timedelta(days=7)).scalar()
    )
    last_30d = (
        db.query(func.count(model.id)).filter(timestamp_col >= now - timedelta(days=30)).scalar()
    )
    return {"total": total, "last_7d": last_7d, "last_30d": last_30d}


@admin_bp.route("/admin/summary", methods=["GET"])
@require_admin
def summary() -> Response:
    db = SessionLocal()
    try:
        volume = {
            "workouts": _volume_counts(db, Workout, Workout.created_at),
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
        rows = (
            db.query(func.date(timestamp_col).label("day"), func.count(model.id))
            .filter(timestamp_col >= start)
            .group_by("day")
            .all()
        )
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
