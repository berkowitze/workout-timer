import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Workout(Base):  # type: ignore[valid-type, misc]
    __tablename__ = "workouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    exercises = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "exercises": self.exercises,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class User(Base):  # type: ignore[valid-type, misc]
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # null for Google-only users
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkoutAttempt(Base):  # type: ignore[valid-type, misc]
    __tablename__ = "workout_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_id = Column(UUID(as_uuid=True), ForeignKey("workouts.id"), nullable=False, index=True)
    # Nullable: set from a valid JWT when present, else null for a guest attempt.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    # Client-generated UUID identifying a returning guest, sent only when there's no user_id.
    anonymous_id = Column(String(255), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="started")
    total_exercises = Column(Integer, nullable=False)
    numeric_exercise_count = Column(Integer, nullable=False)
    exercises_completed = Column(Integer, nullable=False, default=0)
    # Null whenever the workout has any rep-based exercise (no fixed expected length).
    expected_duration_seconds = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "workout_id": str(self.workout_id),
            "user_id": str(self.user_id) if self.user_id else None,
            "anonymous_id": self.anonymous_id,
            "status": self.status,
            "total_exercises": self.total_exercises,
            "numeric_exercise_count": self.numeric_exercise_count,
            "exercises_completed": self.exercises_completed,
            "expected_duration_seconds": self.expected_duration_seconds,
            "duration_seconds": self.duration_seconds,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
