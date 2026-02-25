import json
import os
from typing import Any

from flask import Blueprint, Response, jsonify, request
from openai import OpenAI
from pydantic import ValidationError

from routes.auth import require_auth
from schemas import WorkoutParsed

ai_bp = Blueprint("ai", __name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

MAX_RETRIES = 2

PARSE_SYSTEM_PROMPT = """You are a workout parser. Convert workout descriptions into JSON.

Output ONLY valid JSON with this exact structure — no markdown, no explanation:
{"exercises": [<exercise>, ...]}

Each exercise must be one of:

  {"type": "timed", "name": "...", "duration": <seconds>}
    Optional field: "instruction": "..."

  {"type": "rest", "duration": <seconds>}

  {"type": "numeric", "name": "...", "count": <integer>}
    Optional fields: "unit": "...", "instruction": "..."

  {"type": "loop", "rounds": <integer>, "exercises": [<exercise>, ...]}
    Loops can be nested.

Guidelines:

Keep the order of exercises as close as possible to the original text.

LOOPS: Extract the round count from phrases like "3 rounds of:", "repeat 4 times:", etc.
Use your best judgment (indentation, newlines, wording) to determine loop boundaries.
Nested loops are allowed.

SINGLE ROUNDS: Do NOT wrap the whole workout in a loop of 1. "1 round of X, Y" → [X, Y].

NUMERIC EXERCISES: Always extract a number.
- "1000m row" → count: 1000, unit: "meters", name: "row"
- "20 pushups" → count: 20, name: "pushups"
- "50 cal row" → count: 50, unit: "calories", name: "row"

TIME: Convert to seconds (1 minute = 60, 6 minutes = 360).

CONTEXT: Include parenthetical context in names when relevant.
"1 minute max effort (rowing)" → name: "row", instruction: "max effort"

INSTRUCTIONS: Extract intensity/form cues into "instruction".
"on/off" patterns → alternating work (timed) and rest."""

NAME_SYSTEM_PROMPT = """Generate a short, catchy workout name (2-4 words) based on the exercises.
Respond with the name only — no quotes, no explanation.
Examples: Core Crusher, Plank Party, Full Body Burn, Quick HIIT Blast"""


def _clean_exercise(ex: Any) -> dict[str, Any]:
    """Convert ParsedExercise to clean dict with only relevant fields."""
    if ex.type == "timed":
        result: dict[str, Any] = {"type": "timed", "name": ex.name or "exercise", "duration": ex.duration or 0}
        if ex.instruction:
            result["instruction"] = ex.instruction
        return result
    elif ex.type == "rest":
        return {"type": "rest", "duration": ex.duration or 0}
    elif ex.type == "numeric":
        result = {"type": "numeric", "name": ex.name or "exercise", "count": ex.count or 0}
        if ex.unit:
            result["unit"] = ex.unit
        if ex.instruction:
            result["instruction"] = ex.instruction
        return result
    elif ex.type == "loop":
        return {
            "type": "loop",
            "rounds": ex.rounds or 1,
            "exercises": [_clean_exercise(sub) for sub in (ex.exercises or [])],
        }
    return {"type": ex.type}


@ai_bp.route("/parse-workout", methods=["POST"])
@require_auth
def parse_workout() -> tuple[Response, int] | Response:
    try:
        data: dict[str, Any] = request.get_json() or {}
        raw_text = data.get("text", "")

        if not raw_text.strip():
            return jsonify({"error": "No workout text provided"}), 400

        messages: list[dict[str, str]] = [
            {"role": "system", "content": PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ]

        last_error = ""
        for attempt in range(MAX_RETRIES + 1):
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3,
            )
            raw_response = completion.choices[0].message.content or ""

            try:
                parsed_json = json.loads(raw_response)
                validated = WorkoutParsed.model_validate(parsed_json)
                exercises = [_clean_exercise(ex) for ex in validated.exercises]
                return jsonify({"exercises": exercises})
            except (json.JSONDecodeError, ValidationError, Exception) as e:
                last_error = str(e)
                if attempt < MAX_RETRIES:
                    messages.append({"role": "assistant", "content": raw_response})
                    messages.append({
                        "role": "user",
                        "content": f"The JSON you returned had an error: {last_error}\nFix it and return valid JSON only, no explanation.",
                    })

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
                {"role": "user", "content": f"Generate a name for this workout:\n{_summarize_exercises(exercises)}"},
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
