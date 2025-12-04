import os
from typing import Any

from flask import Blueprint, Response, jsonify, request
from openai import OpenAI

from routes.auth import require_auth
from schemas import ParsedExercise, WorkoutName, WorkoutParsed

ai_bp = Blueprint("ai", __name__)


def _clean_exercise(ex: ParsedExercise) -> dict[str, Any]:
    """Convert flat ParsedExercise to clean typed dict with only relevant fields."""
    if ex.type == "timed":
        result: dict[str, Any] = {
            "type": "timed",
            "name": ex.name or "exercise",
            "duration": ex.duration or 0,
        }
        if ex.instruction:
            result["instruction"] = ex.instruction
        return result
    elif ex.type == "rest":
        return {
            "type": "rest",
            "duration": ex.duration or 0,
        }
    elif ex.type == "numeric":
        result = {
            "type": "numeric",
            "name": ex.name or "exercise",
            "count": ex.count or 0,
        }
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

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PARSE_SYSTEM_PROMPT = """You are a workout parser. Convert workout descriptions into structured exercises.

Each exercise must be one of these types:
1. Timed exercise: For exercises with a time duration (e.g., "30s plank", "1 minute plank hold")
2. Rest: For rest periods (e.g., "rest 1 minute", "30 seconds rest")
3. Numeric exercise: For exercises with a count (e.g., "20 pushups", "500m row")
4. Loop: For repeated rounds (e.g., "3 rounds: 20 pushups, 10 situps")

CRITICAL Guidelines:

LOOPS - EXTRACTING ROUND NUMBERS:
- "3 rounds of:" → rounds: 3
- "6 rounds of:" → rounds: 6  
- "repeat 4 times:" → rounds: 4
- ALWAYS extract the actual number from the text. Never default to 1.

NESTED LOOPS: Loops can contain other loops. Pay careful attention to indentation and structure.
Example input:
"3 rounds of:
  6 rounds of:
    1 minute max effort
    1 minute off
  6 minutes rest"

Should become: loop(rounds=3, [loop(rounds=6, [timed 60s, timed 60s]), rest(360)])
- The outer loop has rounds=3
- The inner loop has rounds=6
- The 6-minute rest is INSIDE the 3-round loop, not after it.

CONTEXT FROM PARENTHETICALS: When text in parentheses describes the equipment or activity 
(e.g., "(rowing ergometer)", "(on bike)", "(kettlebell)"), include that context in exercise names.
Example: "1 minute max effort (rowing)" → name: "row", instruction: "max effort"

SINGLE ROUNDS: Do NOT wrap the entire workout in a loop of 1 round. 
If the user says "1 round of X, Y, Z", just output [X, Y, Z] directly, not loop(1, [X, Y, Z]).

OTHER GUIDELINES:
- Parse time durations to seconds (1 minute = 60 seconds, 6 minutes = 360 seconds)
- Extract intensity/form instructions like "max effort", "one arm out" into the instruction field
- For exercises with distance units like "500m row", use the unit field (e.g., unit="meters")
- Phrases like "Then," or "cash-out" indicate the end of a loop and start of new exercises
- "on/off" patterns typically mean alternating work and rest/recovery efforts"""

NAME_SYSTEM_PROMPT = """Generate a short, catchy workout name (2-4 words) based on the exercises provided.
Be creative but descriptive.
Examples: "Core Crusher", "Plank Party", "Full Body Burn", "Quick HIIT Blast", "Strength Circuit"."""


@ai_bp.route("/parse-workout", methods=["POST"])
@require_auth
def parse_workout() -> tuple[Response, int] | Response:
    try:
        data: dict[str, Any] = request.get_json() or {}
        raw_text = data.get("text", "")

        if not raw_text.strip():
            return jsonify({"error": "No workout text provided"}), 400

        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PARSE_SYSTEM_PROMPT},
                {"role": "user", "content": raw_text},
            ],
            response_format=WorkoutParsed,
            temperature=0.3,
        )

        message = completion.choices[0].message

        # Handle refusals
        if message.refusal:
            return jsonify({"error": f"Request refused: {message.refusal}"}), 400

        if message.parsed is None:
            return jsonify({"error": "Failed to parse workout"}), 500

        # Convert to clean typed dicts (removes null fields, ensures proper structure)
        exercises = [_clean_exercise(ex) for ex in message.parsed.exercises]

        return jsonify({"exercises": exercises})

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

        # Create a summary of exercises for the AI
        exercise_summary = _summarize_exercises(exercises)

        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": NAME_SYSTEM_PROMPT},
                {"role": "user", "content": f"Generate a name for this workout:\n{exercise_summary}"},
            ],
            response_format=WorkoutName,
            temperature=0.8,
        )

        message = completion.choices[0].message

        if message.refusal:
            return jsonify({"name": "My Workout"})

        if message.parsed is None:
            return jsonify({"name": "My Workout"})

        return jsonify({"name": message.parsed.name})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _summarize_exercises(exercises: list[dict[str, Any]], indent: int = 0) -> str:
    """Create a human-readable summary of exercises for the AI."""
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
