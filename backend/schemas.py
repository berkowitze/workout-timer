from typing import Literal

from pydantic import BaseModel


class TimedExercise(BaseModel):
    type: Literal["timed"]
    name: str
    duration: int
    instruction: str | None = None


class RestExercise(BaseModel):
    type: Literal["rest"]
    duration: int


class NumericExercise(BaseModel):
    type: Literal["numeric"]
    name: str
    count: int
    unit: str | None = None
    instruction: str | None = None


# For OpenAI structured outputs, we need to avoid recursive discriminated unions
# which generate oneOf schemas. Instead, we use a flat exercise structure.
class ParsedExercise(BaseModel):
    """A single exercise that can be any type including nested loops."""

    type: Literal["timed", "rest", "numeric", "loop"]
    # For timed/rest
    duration: int | None = None
    # For timed/numeric
    name: str | None = None
    instruction: str | None = None
    # For numeric
    count: int | None = None
    unit: str | None = None
    # For loop
    rounds: int | None = None
    exercises: list["ParsedExercise"] | None = None


# Rebuild to resolve forward references
ParsedExercise.model_rebuild()


class WorkoutParsed(BaseModel):
    """Structured workout parsed from natural language description."""

    exercises: list[ParsedExercise]


class WorkoutName(BaseModel):
    """Generated workout name."""

    name: str


# These are kept for internal use (not OpenAI parsing)
class LoopExercise(BaseModel):
    type: Literal["loop"]
    rounds: int
    exercises: list["TimedExercise | RestExercise | NumericExercise | LoopExercise"]


LoopExercise.model_rebuild()

Exercise = TimedExercise | RestExercise | NumericExercise | LoopExercise
