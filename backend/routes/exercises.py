import os
from typing import Any

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from services.exercise_matching import match_many

exercises_bp = Blueprint("exercises", __name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@exercises_bp.route("/exercises/match", methods=["POST"])
def match() -> tuple[Response, int] | Response:
    data: dict[str, Any] = request.get_json() or {}
    names = data.get("names")
    if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
        return jsonify({"error": "names must be a list of strings"}), 400

    db = SessionLocal()
    try:
        return jsonify(match_many(db, names))
    finally:
        db.close()
