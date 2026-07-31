import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from math import sqrt
from typing import Any

from openai import OpenAI
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from models import Exercise, UnmatchedExerciseTerm

EMBEDDING_MODEL = "text-embedding-3-small"

# Tuned per plans/02-exercise-library-matching.md; revisit once there's real
# match-quality data to tune against.
TRIGRAM_THRESHOLD = 0.45
EMBEDDING_THRESHOLD = 0.80

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Server-side cache: normalized raw name -> match dict, or None for "no match".
# Shared across every caller since the same exercise name recurs constantly
# across workouts - this is what keeps the trigram/embedding tiers cheap in
# aggregate even though any single cache-miss lookup does real work.
_match_cache: dict[str, dict[str, Any] | None] = {}


def invalidate_cache() -> None:
    """Call after any admin write (create/edit/delete/alias) - library edits
    should change future match results, not just for brand new lookups but for
    names that were already cached with a now-stale answer."""
    _match_cache.clear()


def normalize(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace - handles the
    spelling/spacing/punctuation variance (situps/sit ups/sit-ups!!) that's
    the whole reason tier 2 (alias) and tier 3 (trigram) exist."""
    folded = unicodedata.normalize("NFKD", name).lower()
    stripped = re.sub(r"[^a-z0-9\s]", "", folded)
    return re.sub(r"\s+", " ", stripped).strip()


def embedding_input(name: str, aliases: list[str]) -> str:
    return ", ".join([name, *aliases])


def embed_text(text_value: str) -> list[float]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=text_value)
    return response.data[0].embedding


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = sqrt(sum(x * x for x in a))
    norm_b = sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass
class MatchResult:
    exercise: Exercise
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "exercise_id": str(self.exercise.id),
            "name": self.exercise.name,
            "confidence": round(self.confidence, 3),
            "needs_equipment": self.exercise.needs_equipment,
            # Carried here (rather than a second per-exercise fetch) since the
            # frontend's info-icon popover is driven entirely by this one
            # batch response - see "Frontend: the info icon" in the plan.
            "description": self.exercise.description,
            "video_url": self.exercise.video_url,
        }


def _match_exact(db: Session, normalized: str) -> MatchResult | None:
    for exercise in db.query(Exercise).all():
        candidates = [exercise.name, *(exercise.aliases or [])]
        if any(normalize(candidate) == normalized for candidate in candidates):
            return MatchResult(exercise, 1.0)
    return None


def _match_trigram(db: Session, normalized: str) -> MatchResult | None:
    row = db.execute(
        sql_text(
            """
            SELECT id, MAX(sim) AS best_sim
            FROM (
                SELECT id, similarity(name, :term) AS sim FROM exercises
                UNION ALL
                SELECT e.id, similarity(alias, :term) AS sim
                FROM exercises e, jsonb_array_elements_text(e.aliases) AS alias
            ) candidates
            GROUP BY id
            ORDER BY best_sim DESC
            LIMIT 1
            """
        ),
        {"term": normalized},
    ).first()

    if row is None or row.best_sim is None or row.best_sim < TRIGRAM_THRESHOLD:
        return None

    exercise = db.get(Exercise, row.id)
    return MatchResult(exercise, row.best_sim) if exercise else None


def _match_embedding(db: Session, normalized: str) -> MatchResult | None:
    exercises = db.query(Exercise).filter(Exercise.embedding.isnot(None)).all()
    if not exercises:
        return None

    query_embedding = embed_text(normalized)

    best_exercise: Exercise | None = None
    best_score = 0.0
    for exercise in exercises:
        score = _cosine_similarity(query_embedding, exercise.embedding)  # type: ignore[arg-type]
        if score > best_score:
            best_score = score
            best_exercise = exercise

    if best_exercise is None or best_score < EMBEDDING_THRESHOLD:
        return None
    return MatchResult(best_exercise, best_score)


def _bump_unmatched(db: Session, normalized: str) -> None:
    term = (
        db.query(UnmatchedExerciseTerm)
        .filter(UnmatchedExerciseTerm.raw_name == normalized)
        .first()
    )
    if term:
        term.seen_count += 1
        term.last_seen_at = datetime.utcnow()
    else:
        term = UnmatchedExerciseTerm(raw_name=normalized)
        db.add(term)
    db.commit()


def match_one(db: Session, raw_name: str) -> dict[str, Any] | None:
    normalized = normalize(raw_name)
    if not normalized:
        return None
    if normalized in _match_cache:
        return _match_cache[normalized]

    result = (
        _match_exact(db, normalized)
        or _match_trigram(db, normalized)
        or _match_embedding(db, normalized)
    )

    if result is None:
        _bump_unmatched(db, normalized)
        _match_cache[normalized] = None
        return None

    match_dict = result.to_dict()
    _match_cache[normalized] = match_dict
    return match_dict


def match_many(db: Session, raw_names: list[str]) -> dict[str, dict[str, Any] | None]:
    return {raw_name: match_one(db, raw_name) for raw_name in raw_names}
