import os
import uuid as uuid_module
from typing import Any

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Workout
from routes.auth import require_auth

workouts_bp = Blueprint("workouts", __name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@workouts_bp.route("/workouts", methods=["GET"])
@require_auth
def list_workouts() -> Response:
    db = SessionLocal()
    try:
        workouts = db.query(Workout).order_by(Workout.created_at.desc()).all()
        return jsonify([w.to_dict() for w in workouts])
    finally:
        db.close()


@workouts_bp.route("/workouts", methods=["POST"])
@require_auth
def create_workout() -> tuple[Response, int]:
    db = SessionLocal()
    try:
        data: dict[str, Any] = request.get_json() or {}

        if not data.get("name"):
            return jsonify({"error": "Name is required"}), 400
        if not data.get("exercises"):
            return jsonify({"error": "Exercises are required"}), 400

        workout = Workout(
            name=data["name"],
            exercises=data["exercises"],
        )
        db.add(workout)
        db.commit()
        db.refresh(workout)

        return jsonify(workout.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()


@workouts_bp.route("/workouts/<workout_id>", methods=["GET"])
@require_auth
def get_workout(workout_id: str) -> tuple[Response, int] | Response:
    db = SessionLocal()
    try:
        try:
            workout_uuid = uuid_module.UUID(workout_id)
        except ValueError:
            return jsonify({"error": "Invalid workout ID"}), 400

        workout = db.query(Workout).filter(Workout.id == workout_uuid).first()

        if not workout:
            return jsonify({"error": "Workout not found"}), 404

        return jsonify(workout.to_dict())
    finally:
        db.close()
