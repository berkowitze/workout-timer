import json
import os
import uuid as uuid_module
from typing import Any

from flask import Blueprint, Response, jsonify, request
from openai import OpenAI
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import ParseEvent
from prompts import MODIFY_SYSTEM_PROMPT, NAME_SYSTEM_PROMPT, SYSTEM_PROMPT
from routes.auth import get_current_user_id, require_auth
from schemas import ParsedExercise, WorkoutParsed
from utils import clean_exercise

ai_bp = Blueprint("ai", __name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MAX_RETRIES = 2
PARSE_MODEL = "gpt-5.4-nano"

TIME_UNITS = {"second", "seconds", "sec", "secs", "minute", "minutes", "min", "mins", "hour", "hours"}

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _log_parse_event(
    *,
    session_id: uuid_module.UUID,
    turn_index: int,
    is_modification: bool,
    prompt_text: str,
    input_exercises: list[dict[str, Any]] | None,
    output_exercises: list[dict[str, Any]] | None,
    success: bool,
    error_message: str | None,
    retry_count: int,
) -> None:
    """Best-effort audit log — never let a logging failure break the actual parse."""
    db = SessionLocal()
    try:
        user_id = get_current_user_id()
        db.add(
            ParseEvent(
                session_id=session_id,
                turn_index=turn_index,
                is_modification=is_modification,
                user_id=uuid_module.UUID(user_id) if user_id else None,
                prompt_text=prompt_text,
                input_exercises=input_exercises,
                output_exercises=output_exercises,
                success=success,
                error_message=error_message,
                model=PARSE_MODEL,
                retry_count=retry_count,
            )
        )
        db.commit()
    except Exception as e:
        print(f"Failed to log parse event: {e}")
    finally:
        db.close()


def _check_semantics(exercises: list[ParsedExercise]) -> None:
    """Catch semantically-invalid output that schema validation can't (e.g. a timed
    hold mislabeled as numeric reps with a time unit)."""
    for ex in exercises:
        if ex.type == "numeric" and (ex.unit or "").strip().lower() in TIME_UNITS:
            raise ValueError(
                f"Exercise '{ex.name}' is type 'numeric' with a time unit ('{ex.unit}') — "
                "time-based exercises must use type 'timed' with a duration instead."
            )
        if ex.type == "loop" and ex.exercises:
            _check_semantics(ex.exercises)


@ai_bp.route("/parse-workout", methods=["POST"])
@require_auth
def parse_workout() -> tuple[Response, int] | Response:
    try:
        data: dict[str, Any] = request.get_json() or {}
        raw_text = data.get("text", "")
        current_exercises = data.get("current_exercises")

        if not raw_text.strip():
            return jsonify({"error": "No workout text provided"}), 400

        is_modification = bool(current_exercises)

        try:
            session_id = uuid_module.UUID(data["session_id"]) if data.get("session_id") else uuid_module.uuid4()
        except ValueError:
            session_id = uuid_module.uuid4()

        db = SessionLocal()
        try:
            turn_index = db.query(ParseEvent).filter(ParseEvent.session_id == session_id).count()
        finally:
            db.close()

        if is_modification:
            messages: list[dict[str, str]] = [
                {"role": "system", "content": MODIFY_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Current workout:\n{json.dumps({'exercises': current_exercises})}\n\n"
                        f"Instruction: {raw_text}"
                    ),
                },
            ]
        else:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": raw_text},
            ]

        last_error = ""
        for attempt in range(MAX_RETRIES + 1):
            completion = client.chat.completions.create(
                model=PARSE_MODEL,
                messages=messages,  # type: ignore[arg-type]
                temperature=0.3,
            )
            raw_response = completion.choices[0].message.content or ""

            try:
                parsed_json = json.loads(raw_response)
                validated = WorkoutParsed.model_validate(parsed_json)
                _check_semantics(validated.exercises)
                exercises = [clean_exercise(ex) for ex in validated.exercises]
                _log_parse_event(
                    session_id=session_id,
                    turn_index=turn_index,
                    is_modification=is_modification,
                    prompt_text=raw_text,
                    input_exercises=current_exercises,
                    output_exercises=exercises,
                    success=True,
                    error_message=None,
                    retry_count=attempt,
                )
                return jsonify({"exercises": exercises, "session_id": str(session_id)})
            except (json.JSONDecodeError, ValidationError, Exception) as e:
                last_error = str(e)
                if attempt < MAX_RETRIES:
                    messages.append({"role": "assistant", "content": raw_response})
                    messages.append(
                        {
                            "role": "user",
                            "content": f"The JSON you returned had an error: {last_error}\nFix it and return valid JSON only, no explanation.",
                        }
                    )

        _log_parse_event(
            session_id=session_id,
            turn_index=turn_index,
            is_modification=is_modification,
            prompt_text=raw_text,
            input_exercises=current_exercises,
            output_exercises=None,
            success=False,
            error_message=last_error,
            retry_count=MAX_RETRIES,
        )
        return jsonify({"error": f"Failed to parse workout: {last_error}"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/generate-name", methods=["POST"])
@require_auth
def generate_name() -> tuple[Response, int] | Response:
    try:
        data: dict[str, Any] = request.get_json() or {}
        exercises = data.get("exercises", [])

        if not exercises:
            return jsonify({"error": "No exercises provided"}), 400

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": NAME_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Generate a name for this workout:\n{_summarize_exercises(exercises)}",
                },
            ],
            temperature=0.8,
            max_tokens=16,
        )

        name = (completion.choices[0].message.content or "My Workout").strip().strip('"')
        return jsonify({"name": name})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _summarize_exercises(exercises: list[dict[str, Any]], indent: int = 0) -> str:
    lines = []
    prefix = "  " * indent
    for ex in exercises:
        ex_type = ex.get("type", "")
        if ex_type == "timed":
            line = f"{prefix}- {ex.get('duration', 0)}s {ex.get('name', 'exercise')}"
            if ex.get("instruction"):
                line += f" ({ex['instruction']})"
        elif ex_type == "rest":
            line = f"{prefix}- Rest {ex.get('duration', 0)}s"
        elif ex_type == "numeric":
            line = f"{prefix}- {ex.get('count', 0)} {ex.get('name', 'exercise')}"
            if ex.get("unit"):
                line += f" ({ex['unit']})"
            if ex.get("instruction"):
                line += f" - {ex['instruction']}"
        elif ex_type == "loop":
            line = f"{prefix}- {ex.get('rounds', 1)} rounds:"
            lines.append(line)
            lines.append(_summarize_exercises(ex.get("exercises", []), indent + 1))
            continue
        else:
            continue
        lines.append(line)
    return "\n".join(lines)
