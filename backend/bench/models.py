"""Model definitions and registry."""

from dataclasses import dataclass


@dataclass
class Model:
    provider: str
    name: str
    model_id: str
    env_key: str
    structured: bool = False


MODELS = [
    # OpenAI
    Model("openai", "gpt-4o-mini", "gpt-4o-mini", "OPENAI_API_KEY"),
    Model("openai", "gpt-4o-mini", "gpt-4o-mini", "OPENAI_API_KEY", structured=True),
    Model("openai", "gpt-4.1-mini", "gpt-4.1-mini", "OPENAI_API_KEY"),
    Model("openai", "gpt-4.1-mini", "gpt-4.1-mini", "OPENAI_API_KEY", structured=True),
    Model("openai", "gpt-4.1-nano", "gpt-4.1-nano", "OPENAI_API_KEY"),
    Model("openai", "gpt-4.1-nano", "gpt-4.1-nano", "OPENAI_API_KEY", structured=True),
    # Anthropic
    Model("anthropic", "claude-haiku-4-5", "claude-haiku-4-5-20251001", "ANTHROPIC_API_KEY"),
    # Google
    Model("google", "gemini-2.5-flash", "gemini-2.5-flash", "GOOGLE_API_KEY"),
    Model("google", "gemini-2.5-flash", "gemini-2.5-flash", "GOOGLE_API_KEY", structured=True),
    Model("google", "gemini-2.5-flash-lite", "gemini-2.5-flash-lite", "GOOGLE_API_KEY"),
    Model(
        "google",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash-lite",
        "GOOGLE_API_KEY",
        structured=True,
    ),
    # Groq (OpenAI-compatible)
    Model("groq", "llama-3.3-70b", "llama-3.3-70b-versatile", "GROQ_API_KEY"),
    Model("groq", "llama-3.3-70b", "llama-3.3-70b-versatile", "GROQ_API_KEY", structured=True),
    Model("groq", "llama-3.1-8b", "llama-3.1-8b-instant", "GROQ_API_KEY"),
    Model("groq", "llama-3.1-8b", "llama-3.1-8b-instant", "GROQ_API_KEY", structured=True),
    # Cerebras (OpenAI-compatible)
    Model("cerebras", "llama3.1-8b", "llama3.1-8b", "CEREBRAS_API_KEY"),
    Model("cerebras", "llama3.1-8b", "llama3.1-8b", "CEREBRAS_API_KEY", structured=True),
]


def find_model(name: str, structured: bool) -> Model | None:
    """Find a model by name and structured flag."""
    for m in MODELS:
        if m.name == name and m.structured == structured:
            return m
    return None
