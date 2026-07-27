"""
Run a specific model against test workouts and save parsed results to the database.

Usage:
    python -m bench.test --model gemini-2.5-flash-lite
    python -m bench.test --model gpt-4o-mini --structured
"""

import argparse
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Workout

from .models import MODELS, find_model
from .parsing import parse_raw, validate_response
from .providers import call_model
from .workouts import WORKOUTS

load_dotenv()


def main() -> None:
    parser = argparse.ArgumentParser(description="Test a model and save results to DB")
    parser.add_argument("--model", required=True, help="Model name (e.g. gemini-2.5-flash-lite)")
    parser.add_argument("--structured", action="store_true", help="Use structured output mode")
    args = parser.parse_args()

    model = find_model(args.model, args.structured)
    if model is None:
        any_match = find_model(args.model, not args.structured)
        if any_match and args.structured:
            print(f"Error: {args.model} does not support --structured mode")
        elif any_match:
            print(f"Error: {args.model} only has a structured variant in MODELS")
        else:
            print(f"Error: model '{args.model}' not found in MODELS list")
            print("Available models:")
            seen = set()
            for m in MODELS:
                key = (m.name, m.structured)
                if key not in seen:
                    seen.add(key)
                    s = " (structured)" if m.structured else ""
                    print(f"  {m.name}{s}")
        sys.exit(1)

    api_key = os.getenv(model.env_key, "")
    if not api_key:
        print(f"Error: {model.env_key} not set")
        sys.exit(1)

    db_url = os.getenv("DATABASE_URL", "postgresql://localhost:5432/workout_timer")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    struct_label = "-structured" if args.structured else ""

    for label, text in WORKOUTS.items():
        workout_name = f"{args.model}{struct_label}-{label}"
        print(f"Running {workout_name}...", end=" ", flush=True)

        try:
            raw = call_model(model, text)
            valid, err = validate_response(raw)
            if not valid:
                print(f"INVALID: {err}")
                continue

            result = parse_raw(raw)
            exercises = result["exercises"]
            db = SessionLocal()
            try:
                workout = Workout(name=workout_name, exercises=exercises)
                db.add(workout)
                db.commit()
                print(f"OK ({len(exercises)} exercises)")
            except Exception as e:
                db.rollback()
                print(f"DB error: {e}")
            finally:
                db.close()

        except Exception as e:
            print(f"ERROR: {e}")


if __name__ == "__main__":
    main()
