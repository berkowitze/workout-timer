"""
Benchmark LLM models for workout parsing speed and correctness.

Usage:
    python -m bench.perf
    python -m bench.perf --parallel
    python -m bench.perf --reset
"""

import argparse
import os
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from threading import Semaphore

from dotenv import load_dotenv

from .models import MODELS, Model
from .parsing import validate_response
from .providers import call_model
from .workouts import WORKOUTS

load_dotenv()


@dataclass
class Result:
    provider: str
    model_name: str
    structured: bool
    workout_label: str
    duration_s: float
    valid: bool
    error: str


PASSED_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".perf_passed.txt")


def _task_key(model: Model, label: str) -> str:
    struct = "structured" if model.structured else "unstructured"
    return f"{model.provider}/{model.name}/{struct}/{label}"


def _load_passed() -> set[str]:
    try:
        with open(PASSED_FILE) as f:
            return {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        return set()


def _save_passed(passed: set[str]) -> None:
    with open(PASSED_FILE, "w") as f:
        f.write("\n".join(sorted(passed)) + "\n")


def run_benchmark(parallel: bool = False) -> list[Result]:
    results: list[Result] = []

    available_keys = {
        key
        for key in [
            "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY",
            "GOOGLE_API_KEY",
            "GROQ_API_KEY",
            "CEREBRAS_API_KEY",
        ]
        if os.getenv(key)
    }
    print(f"Available API keys: {', '.join(sorted(available_keys)) or 'NONE'}\n")

    passed = _load_passed()

    tasks: list[tuple[Model, str, str]] = []
    for model in MODELS:
        struct_label = "structured" if model.structured else "unstructured"
        if model.env_key not in available_keys:
            print(f"  SKIP {model.provider}/{model.name} [{struct_label}] (no {model.env_key})")
            for label in WORKOUTS:
                results.append(
                    Result(
                        model.provider, model.name, model.structured, label, -1, False, "no api key"
                    )
                )
        else:
            for label, text in WORKOUTS.items():
                key = _task_key(model, label)
                if key in passed:
                    print(f"  SKIP {key} (already passed)")
                    results.append(
                        Result(model.provider, model.name, model.structured, label, -1, True, "")
                    )
                else:
                    tasks.append((model, label, text))

    PROVIDER_MAX_CONCURRENT = defaultdict(
        lambda: 2,
        {"openai": 3, "google": 2, "anthropic": 2, "groq": 2, "cerebras": 2},
    )

    def run_one(model: Model, label: str, text: str, sem: Semaphore | None = None) -> Result:
        if sem:
            sem.acquire()
        start = time.perf_counter()
        try:
            raw = call_model(model, text)
            elapsed = time.perf_counter() - start
            valid, err = validate_response(raw)
            return Result(
                model.provider, model.name, model.structured, label, round(elapsed, 2), valid, err
            )
        except Exception as e:
            elapsed = time.perf_counter() - start
            return Result(
                model.provider, model.name, model.structured, label, round(elapsed, 2), False, str(e)
            )
        finally:
            if sem:
                sem.release()

    def fmt_result(model: Model, label: str, result: Result) -> str:
        struct_label = "structured" if model.structured else "unstructured"
        desc = f"{model.provider}/{model.name} [{struct_label}] [{label}]"
        status = "OK" if result.valid else ("ERROR" if result.error else "INVALID")
        return f"  {desc}: {result.duration_s:.2f}s {status}"

    if parallel:
        provider_sems: dict[str, Semaphore] = {
            p: Semaphore(PROVIDER_MAX_CONCURRENT[p]) for p in {m.provider for m, _, _ in tasks}
        }
        total = len(tasks)
        completed = 0
        print(f"  Running {total} tasks in parallel...")
        with ThreadPoolExecutor(max_workers=total) as executor:
            futures = {
                executor.submit(run_one, model, label, text, provider_sems[model.provider]): (
                    model,
                    label,
                )
                for model, label, text in tasks
            }
            for future in as_completed(futures):
                model, label = futures[future]
                result = future.result()
                results.append(result)
                completed += 1
                print(fmt_result(model, label, result))
                if result.valid:
                    passed.add(_task_key(model, label))
        _save_passed(passed)
        print(f"  Done! ({completed}/{total})")
    else:
        for model, label, text in tasks:
            result = run_one(model, label, text)
            results.append(result)
            print(fmt_result(model, label, result))
            if result.valid:
                passed.add(_task_key(model, label))
                _save_passed(passed)
            else:
                _save_passed(passed)
                err_detail = result.error or "invalid JSON output"
                struct_label = "structured" if model.structured else "unstructured"
                print(f"\nFAILED: {model.provider}/{model.name} [{struct_label}] [{label}]")
                print(f"  {err_detail}")
                return results

        print("  All passed!")

    return results


def write_markdown(results: list[Result], path: str) -> None:
    models_seen: list[tuple[str, str, bool]] = []
    data: dict[tuple[str, str, bool], dict[str, Result]] = {}

    for r in results:
        key = (r.provider, r.model_name, r.structured)
        if key not in data:
            data[key] = {}
            models_seen.append(key)
        data[key][r.workout_label] = r

    def fmt_time(r: Result | None) -> str:
        if r is None:
            return "-"
        if r.duration_s < 0:
            return "skip"
        if r.error and not r.valid:
            return "ERR"
        mark = "" if r.valid else " *"
        return f"{r.duration_s:.2f}{mark}"

    def fmt_err(r: Result | None) -> str:
        if r is None or not r.error:
            return ""
        if r.error == "no api key":
            return "no api key"
        return r.error

    lines = [
        "# Workout Parse Benchmark Results",
        "",
        f"_Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}_",
        "",
        "| Provider | Model | Structured | Simple (s) | Complex (s) | Errors |",
        "|----------|-------|-----------|-----------|------------|--------|",
    ]

    for provider, model_name, structured in models_seen:
        d = data[(provider, model_name, structured)]
        simple = d.get("simple")
        complex_ = d.get("complex")
        errors = [e for e in [fmt_err(simple), fmt_err(complex_)] if e]
        err_col = "; ".join(errors) if errors else ""
        struct_col = "yes" if structured else "no"
        lines.append(
            f"| {provider} | {model_name} | {struct_col} | {fmt_time(simple)} | {fmt_time(complex_)} | {err_col} |"
        )

    lines.extend(["", "_* = invalid JSON output, ERR = request failed_", ""])

    with open(path, "w") as f:
        f.write("\n".join(lines))
    print(f"\nResults written to {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark LLM models for workout parsing")
    parser.add_argument("--parallel", action="store_true", help="Run API calls in parallel")
    parser.add_argument("--reset", action="store_true", help="Clear passed-tasks cache and re-run")
    args = parser.parse_args()

    if args.reset and os.path.exists(PASSED_FILE):
        os.remove(PASSED_FILE)
        print("Cleared passed-tasks cache.\n")

    print("=== Workout Parse Benchmark ===\n")
    results = run_benchmark(parallel=args.parallel)
    print()
    md_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "perf.md")
    write_markdown(results, md_path)
