import json
import os
from typing import Any

from flask import Blueprint, Response, jsonify, request
from openai import OpenAI
from pydantic import ValidationError

from prompts import NAME_SYSTEM_PROMPT, SYSTEM_PROMPT
from routes.auth import require_auth
from schemas import ParsedExercise, WorkoutParsed
from utils import clean_exercise

ai_bp = Blueprint("ai", __name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MAX_RETRIES = 2

TIME_UNITS = {"second", "seconds", "sec", "secs", "minute", "minutes", "min", "mins", "hour", "hours"}


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

        if not raw_text.strip():
            return jsonify({"error": "No workout text provided"}), 400

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ]

        last_error = ""
        for attempt in range(MAX_RETRIES + 1):
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,  # type: ignore[arg-type]
                temperature=0.3,
            )
            raw_response = completion.choices[0].message.content or ""

            try:
                parsed_json = json.loads(raw_response)
                validated = WorkoutParsed.model_validate(parsed_json)
                _check_semantics(validated.exercises)
                exercises = [clean_exercise(ex) for ex in validated.exercises]
                return jsonify({"exercises": exercises})
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
