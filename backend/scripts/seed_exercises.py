"""One-off seed for the exercise library. Safe to re-run: skips any name that
already exists (case-insensitive) rather than overwriting admin edits.

Usage: venv/bin/python -m scripts.seed_exercises
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Exercise  # noqa: E402
from services.exercise_matching import embed_text, embedding_input  # noqa: E402

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Starter batch: PRESET_EXERCISES (frontend/src/types/workout.ts) plus a
# handful of obvious additions. Only sit-ups ships with a real video link;
# the rest can get one added later via the admin CRUD.
SEED_EXERCISES: list[dict] = [
    {
        "name": "Plank",
        "aliases": ["planks"],
        "description": "Hold a straight-body position on forearms and toes, core braced.",
        "needs_equipment": False,
    },
    {
        "name": "Push-ups",
        "aliases": ["pushups", "push ups", "push up", "pushup"],
        "description": "From a plank position, lower your chest to the floor and press back up.",
        "needs_equipment": False,
    },
    {
        "name": "Sit-ups",
        "aliases": ["situps", "sit ups", "sit up"],
        "description": "Lying on your back with knees bent, curl your torso up to your knees.",
        "video_url": "https://www.youtube.com/shorts/H8apFXZI500",
        "needs_equipment": False,
    },
    {
        "name": "Squats",
        "aliases": ["squat", "bodyweight squats", "air squats"],
        "description": "Feet shoulder-width apart, bend knees and hips to lower down, then stand.",
        "needs_equipment": False,
    },
    {
        "name": "Burpees",
        "aliases": ["burpee"],
        "description": "Drop into a squat, kick back to a plank, push up, then jump up.",
        "needs_equipment": False,
    },
    {
        "name": "Lunges",
        "aliases": ["lunge", "walking lunges"],
        "description": "Step forward and lower your hips until both knees are bent ~90 degrees.",
        "needs_equipment": False,
    },
    {
        "name": "Jumping Jacks",
        "aliases": ["jumping jack", "star jumps"],
        "description": "Jump while spreading legs and raising arms overhead, then return to start.",
        "needs_equipment": False,
    },
    {
        "name": "Mountain Climbers",
        "aliases": ["mountain climber"],
        "description": "From a plank, drive knees toward your chest one at a time at pace.",
        "needs_equipment": False,
    },
    {
        "name": "High Knees",
        "aliases": ["high knee", "high knee running"],
        "description": "Jog in place, driving your knees up toward hip height each step.",
        "needs_equipment": False,
    },
    {
        "name": "Row",
        "aliases": ["rowing", "rowing machine", "erg"],
        "description": "Rowing machine intervals, measured by distance.",
        "needs_equipment": True,
    },
    {
        "name": "Pull-ups",
        "aliases": ["pullups", "pull ups", "pull up", "chin ups"],
        "description": "Hang from a bar and pull your chin above it, then lower with control.",
        "needs_equipment": True,
    },
    {
        "name": "Dips",
        "aliases": ["tricep dips", "bench dips"],
        "description": "Lower your body by bending your elbows, then press back up.",
        "needs_equipment": True,
    },
    {
        "name": "Side Plank",
        "aliases": ["side planks", "side plank hold"],
        "description": "Balance on one forearm and the side of one foot, hips lifted and stacked.",
        "needs_equipment": False,
    },
    {
        "name": "Jump Rope",
        "aliases": ["jumping rope", "skipping rope", "jump-rope"],
        "description": "Turn a rope under your feet and jump over it with each turn.",
        "needs_equipment": True,
    },
    {
        "name": "Bicycle Crunches",
        "aliases": ["bicycle crunch", "bicycles"],
        "description": "Alternate touching elbow to opposite knee in a pedaling motion.",
        "needs_equipment": False,
    },
    {
        "name": "Glute Bridge",
        "aliases": ["glute bridges", "hip bridge", "hip thrust"],
        "description": "Lying on your back with knees bent, drive your hips up, squeezing glutes.",
        "needs_equipment": False,
    },
    {
        "name": "Wall Sit",
        "aliases": ["wall sits", "wall squat"],
        "description": "Back flat against a wall, hold a seated position with knees at 90 degrees.",
        "needs_equipment": False,
    },
    {
        "name": "Russian Twists",
        "aliases": ["russian twist"],
        "description": "Seated, lean back slightly and rotate your torso side to side.",
        "needs_equipment": False,
    },
]


def main() -> None:
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        existing_names = {name.lower() for (name,) in db.query(Exercise.name).all()}
        for entry in SEED_EXERCISES:
            if entry["name"].lower() in existing_names:
                skipped += 1
                print(f"skip (exists): {entry['name']}")
                continue

            exercise = Exercise(
                name=entry["name"],
                aliases=entry.get("aliases", []),
                description=entry.get("description"),
                video_url=entry.get("video_url"),
                needs_equipment=entry.get("needs_equipment", False),
                embedding=embed_text(embedding_input(entry["name"], entry.get("aliases", []))),
            )
            db.add(exercise)
            db.commit()
            created += 1
            print(f"created: {entry['name']}")
        print(f"\nDone. {created} created, {skipped} skipped.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
