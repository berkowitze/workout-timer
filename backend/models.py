import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
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
    is_admin = Column(Boolean, nullable=False, default=False)
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


class ParseEvent(Base):  # type: ignore[valid-type, misc]
    """Log of every prompt -> workout parse/modification call, for later analytics
    (e.g. spotting recurring misparses or feeding prompt-tuning). session_id groups
    a fresh parse with any follow-up modification calls made against its result;
    turn_index orders turns within that session."""

    __tablename__ = "parse_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    turn_index = Column(Integer, nullable=False, default=0)
    is_modification = Column(Boolean, nullable=False, default=False)
    # Nullable for schema symmetry with WorkoutAttempt, though /parse-workout
    # currently requires auth so user_id is always set in practice.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    anonymous_id = Column(String(255), nullable=True, index=True)
    prompt_text = Column(Text, nullable=False)
    # Exercises sent as context for a modification call; null for a fresh parse.
    input_exercises = Column(JSONB, nullable=True)
    # Null if the call failed after exhausting retries.
    output_exercises = Column(JSONB, nullable=True)
    success = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)
    model = Column(String(100), nullable=False)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Exercise(Base):  # type: ignore[valid-type, misc]
    """A canonical exercise in the admin-managed library, matched against free-text
    exercise names typed/parsed into workouts. See plans/02-exercise-library-matching.md."""

    __tablename__ = "exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    aliases = Column(JSONB, nullable=False, default=list)
    description = Column(Text, nullable=True)
    video_url = Column(String(500), nullable=True)
    needs_equipment = Column(Boolean, nullable=False, default=False)
    # Embedding of "name + aliases" (OpenAI text-embedding-3-small), recomputed
    # whenever name/aliases change. Brute-force cosine-compared in Python at
    # match time rather than a pgvector column - see the matching plan doc.
    embedding = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "aliases": self.aliases,
            "description": self.description,
            "video_url": self.video_url,
            "needs_equipment": self.needs_equipment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UnmatchedExerciseTerm(Base):  # type: ignore[valid-type, misc]
    """A normalized exercise name that failed to match the library, so admins have
    a queue of real-world gaps to alias or add rather than a one-time seed."""

    __tablename__ = "unmatched_exercise_terms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_name = Column(String(255), nullable=False, unique=True, index=True)
    seen_count = Column(Integer, nullable=False, default=1)
    last_seen_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved = Column(Boolean, nullable=False, default=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "raw_name": self.raw_name,
            "seen_count": self.seen_count,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "resolved": self.resolved,
        }
