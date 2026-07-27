from typing import Any


def clean_exercise(ex: Any) -> dict[str, Any]:
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
            "exercises": [clean_exercise(sub) for sub in (ex.exercises or [])],
        }
    return {"type": ex.type}
