"""Response parsing and validation."""

import json

from pydantic import ValidationError

from schemas import WorkoutParsed
from utils import clean_exercise


def strip_markdown(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        text = "\n".join(lines)
    return text


def validate_response(raw: str) -> tuple[bool, str]:
    """Validate raw LLM output as valid workout JSON. Returns (valid, error_message)."""
    text = strip_markdown(raw)
    try:
        parsed = json.loads(text)
        WorkoutParsed.model_validate(parsed)
        return True, ""
    except (json.JSONDecodeError, ValidationError) as e:
        return False, str(e)


def parse_raw(raw: str) -> dict:
    """Parse raw LLM output into a clean exercise dict."""
    text = strip_markdown(raw)
    parsed = json.loads(text)
    validated = WorkoutParsed.model_validate(parsed)
    return {"exercises": [clean_exercise(ex) for ex in validated.exercises]}
