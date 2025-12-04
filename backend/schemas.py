from typing import Literal

from pydantic import BaseModel, Field


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

    type: Literal["timed", "rest", "numeric", "loop"] = Field(
        description="The type of exercise: timed, rest, numeric, or loop"
    )
    # For timed/rest
    duration: int | None = Field(
        default=None, description="Duration in seconds for timed exercises or rest periods"
    )
    # For timed/numeric
    name: str | None = Field(
        default=None, description="Name of the exercise (e.g., 'plank', 'pushups', 'row')"
    )
    instruction: str | None = Field(
        default=None, description="Additional instructions like 'max effort', 'one arm out'"
    )
    # For numeric
    count: int | None = Field(
        default=None, description="Number of repetitions for numeric exercises"
    )
    unit: str | None = Field(
        default=None, description="Unit for numeric exercises (e.g., 'meters', 'calories')"
    )
    # For loop
    rounds: int | None = Field(
        default=None,
        description="Number of rounds/repetitions for a loop. Extract this from phrases like '3 rounds of', '6 rounds:', 'repeat 4 times'",
    )
    exercises: list["ParsedExercise"] | None = Field(
        default=None, description="List of exercises contained within a loop"
    )


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
