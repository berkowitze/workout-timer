"""
Evaluate model correctness by comparing live output against expected workout structures.

Usage:
    python -m bench.eval --model gemini-2.5-flash-lite
    python -m bench.eval --model gpt-4o-mini --structured
"""

import argparse
import os
import sys
from typing import Any

from dotenv import load_dotenv

from .models import MODELS, find_model
from .parsing import parse_raw, validate_response
from .providers import call_model
from .workouts import EXPECTED, WORKOUTS

load_dotenv()


def _diff(expected: Any, actual: Any, path: str = "") -> list[str]:
    """Recursively compare two structures, returning a list of difference descriptions."""
    diffs = []
    if type(expected) != type(actual):
        diffs.append(f"{path or 'root'}: type {type(expected).__name__} != {type(actual).__name__}")
        return diffs
    if isinstance(expected, dict):
        all_keys = set(expected) | set(actual)
        for k in sorted(all_keys):
            p = f"{path}.{k}" if path else k
            if k not in actual:
                diffs.append(f"{p}: missing (expected {expected[k]!r})")
            elif k not in expected:
                diffs.append(f"{p}: unexpected (got {actual[k]!r})")
            else:
                diffs.extend(_diff(expected[k], actual[k], p))
    elif isinstance(expected, list):
        for i in range(max(len(expected), len(actual))):
            p = f"{path}[{i}]"
            if i >= len(actual):
                diffs.append(f"{p}: missing (expected {expected[i]!r})")
            elif i >= len(expected):
                diffs.append(f"{p}: unexpected (got {actual[i]!r})")
            else:
                diffs.extend(_diff(expected[i], actual[i], p))
    elif expected != actual:
        diffs.append(f"{path or 'root'}: {expected!r} != {actual!r}")
    return diffs


def compare(expected: dict[str, Any], actual: dict[str, Any]) -> list[str] | None:
    """Return None if equal, or a list of diff strings if different."""
    diffs = _diff(expected, actual)
    return diffs if diffs else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate model correctness")
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

    struct_label = "-structured" if args.structured else ""
    all_passed = True

    for label, text in WORKOUTS.items():
        if label not in EXPECTED:
            print(f"SKIP {label} (no expected output defined)")
            continue

        name = f"{args.model}{struct_label}-{label}"
        print(f"Evaluating {name}...", end=" ", flush=True)

        try:
            raw = call_model(model, text)
            valid, err = validate_response(raw)
            if not valid:
                print(f"FAIL (invalid JSON: {err})")
                all_passed = False
                continue

            actual = parse_raw(raw)
            diffs = compare(EXPECTED[label], actual)
            if diffs is None:
                print("PASS")
            else:
                print("FAIL")
                for d in diffs:
                    print(f"  - {d}")
                all_passed = False

        except Exception as e:
            print(f"ERROR: {e}")
            all_passed = False

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
