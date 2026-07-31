import os
import uuid as uuid_module
from datetime import datetime
from typing import Any

from flask import Blueprint, Response, jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import WorkoutAttempt
from routes.auth import get_current_user_id

attempts_bp = Blueprint("attempts", __name__)

# Public write endpoints with no auth wall, so they're the most exposed
# surface here. In-memory storage is fine for the current single-container
# Railway deploy; if this ever scales to multiple instances, point
# storage_uri at Redis instead — in-memory counters aren't shared across
# processes. This only guards against a single-actor flood, not someone
# gaming one workout's popularity from many different IPs.
limiter = Limiter(key_func=get_remote_address)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@attempts_bp.route("/workouts/<workout_id>/attempts", methods=["POST"])
@limiter.limit("20/minute")
def start_attempt(workout_id: str) -> tuple[Response, int]:
    db = SessionLocal()
    try:
        try:
            workout_uuid = uuid_module.UUID(workout_id)
        except ValueError:
            return jsonify({"error": "Invalid workout ID"}), 400

        data: dict[str, Any] = request.get_json() or {}
        total_exercises = data.get("total_exercises")
        numeric_exercise_count = data.get("numeric_exercise_count")
        if total_exercises is None or numeric_exercise_count is None:
            return (
                jsonify({"error": "total_exercises and numeric_exercise_count are required"}),
                400,
            )

        user_id = get_current_user_id()
        anonymous_id = data.get("anonymous_id")
        if not user_id and not anonymous_id:
            return jsonify({"error": "anonymous_id is required when not authenticated"}), 400

        attempt = WorkoutAttempt(
            workout_id=workout_uuid,
            user_id=uuid_module.UUID(user_id) if user_id else None,
            anonymous_id=anonymous_id if not user_id else None,
            total_exercises=total_exercises,
            numeric_exercise_count=numeric_exercise_count,
            expected_duration_seconds=data.get("expected_duration_seconds"),
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)

        return jsonify({"id": str(attempt.id)}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@attempts_bp.route("/attempts/<attempt_id>", methods=["PATCH"])
@limiter.limit("120/minute")
def update_attempt(attempt_id: str) -> tuple[Response, int] | Response:
    db = SessionLocal()
    try:
        try:
            attempt_uuid = uuid_module.UUID(attempt_id)
        except ValueError:
            return jsonify({"error": "Invalid attempt ID"}), 400

        attempt = db.query(WorkoutAttempt).filter(WorkoutAttempt.id == attempt_uuid).first()
        if not attempt:
            return jsonify({"error": "Attempt not found"}), 404

        data: dict[str, Any] = request.get_json() or {}
        if "exercises_completed" in data:
            attempt.exercises_completed = data["exercises_completed"]
        if "duration_seconds" in data:
            attempt.duration_seconds = data["duration_seconds"]
        if "status" in data:
            attempt.status = data["status"]
            if data["status"] == "completed":
                attempt.completed_at = datetime.utcnow()

        db.commit()
        return jsonify(attempt.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
