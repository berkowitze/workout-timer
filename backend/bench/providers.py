"""LLM provider call functions."""

import os
from typing import Any

import anthropic
from google import genai
from google.genai.types import GenerateContentConfig
from openai import OpenAI

from prompts import SYSTEM_PROMPT
from schemas import WorkoutParsed

from .models import Model


def _build_flat_schema(max_depth: int = 4) -> dict[str, Any]:
    """Build a flattened JSON schema (no $ref) for providers like Google."""
    schema = WorkoutParsed.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(obj: Any, depth: int = 0) -> Any:
        if isinstance(obj, dict):
            if "$ref" in obj:
                if depth >= max_depth:
                    return {"type": "object"}
                ref_name = obj["$ref"].split("/")[-1]
                return resolve(dict(defs[ref_name]), depth + 1)
            return {k: resolve(v, depth) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [resolve(item, depth) for item in obj]
        return obj

    return resolve(schema)  # type: ignore[no-any-return]


WORKOUT_PARSED_SCHEMA_FLAT = _build_flat_schema()


def call_openai(model_id: str, api_key: str, workout_text: str, structured: bool) -> str:
    client = OpenAI(api_key=api_key)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": workout_text},
    ]
    if structured:
        result = client.beta.chat.completions.parse(
            model=model_id,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.3,
            response_format=WorkoutParsed,
        )
        return result.choices[0].message.content or ""
    else:
        completion = client.chat.completions.create(
            model=model_id,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.3,
        )
        return completion.choices[0].message.content or ""


def call_openai_compat(
    model_id: str, api_key: str, base_url: str, workout_text: str, structured: bool
) -> str:
    client = OpenAI(api_key=api_key, base_url=base_url)
    kwargs: dict = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": workout_text},
        ],
        "temperature": 0.3,
    }
    if structured:
        kwargs["response_format"] = {"type": "json_object"}
    completion = client.chat.completions.create(**kwargs)
    return completion.choices[0].message.content or ""


def call_anthropic(model_id: str, api_key: str, workout_text: str) -> str:
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model_id,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": workout_text}],
    )
    return message.content[0].text  # type: ignore[union-attr]


def call_google(model_id: str, api_key: str, workout_text: str, structured: bool) -> str:
    client = genai.Client(api_key=api_key)
    config = GenerateContentConfig(temperature=0.3)
    if structured:
        config = GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
            response_schema=WORKOUT_PARSED_SCHEMA_FLAT,
        )
    response = client.models.generate_content(
        model=model_id,
        contents=f"{SYSTEM_PROMPT}\n\n{workout_text}",
        config=config,
    )
    return response.text or ""


def call_model(model: Model, workout_text: str) -> str:
    """Route a call to the correct provider."""
    api_key = os.getenv(model.env_key, "")
    if model.provider == "openai":
        return call_openai(model.model_id, api_key, workout_text, model.structured)
    elif model.provider == "anthropic":
        return call_anthropic(model.model_id, api_key, workout_text)
    elif model.provider == "google":
        return call_google(model.model_id, api_key, workout_text, model.structured)
    elif model.provider == "groq":
        return call_openai_compat(
            model.model_id,
            api_key,
            "https://api.groq.com/openai/v1",
            workout_text,
            model.structured,
        )
    elif model.provider == "cerebras":
        return call_openai_compat(
            model.model_id, api_key, "https://api.cerebras.ai/v1", workout_text, model.structured
        )
    else:
        raise ValueError(f"Unknown provider: {model.provider}")
