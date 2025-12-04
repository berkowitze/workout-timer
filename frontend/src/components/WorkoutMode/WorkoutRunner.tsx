import { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import type { Exercise, FlattenedExercise } from "../../types/workout";
import { TimerCircle } from "./TimerCircle";
import { ExerciseDisplay } from "./ExerciseDisplay";

interface WorkoutRunnerProps {
  exercises: Exercise[];
  onComplete: () => void;
  onBack: () => void;
  isSaved: boolean;
  onSave: () => void;
}

type WorkoutState = "idle" | "countdown" | "active" | "completed";

function flattenExercises(exercises: Exercise[]): FlattenedExercise[] {
  const result: FlattenedExercise[] = [];

  for (const exercise of exercises) {
    if (exercise.type === "loop") {
      for (let round = 1; round <= exercise.rounds; round++) {
        for (const subExercise of exercise.exercises) {
          if (subExercise.type !== "loop") {
            result.push({
              exercise: subExercise,
              loopInfo: { round, totalRounds: exercise.rounds },
            });
          }
        }
      }
    } else {
      result.push({ exercise });
    }
  }

  return result;
}

export function WorkoutRunner({
  exercises,
  onComplete,
  onBack,
  isSaved,
  onSave,
}: WorkoutRunnerProps) {
  const [state, setState] = useState<WorkoutState>("idle");
  const [isPaused, setIsPaused] = useState(false);
  const [countdownTime, setCountdownTime] = useState(10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [msRemaining, setMsRemaining] = useState(0);

  const flattenedExercises = useRef<FlattenedExercise[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    flattenedExercises.current = flattenExercises(exercises);
  }, [exercises]);

  const currentExercise = flattenedExercises.current[currentIndex] || null;
  const nextExercise = flattenedExercises.current[currentIndex + 1] || null;

  const isTimedExercise =
    currentExercise &&
    (currentExercise.exercise.type === "timed" || currentExercise.exercise.type === "rest");

  const isRest = currentExercise?.exercise.type === "rest";

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const moveToNextExercise = useCallback(() => {
    clearTimer();
    if (currentIndex + 1 >= flattenedExercises.current.length) {
      setState("completed");
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#0077b6", "#2ec4b6", "#00a8e8", "#ffffff"],
      });
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.5 },
          colors: ["#0077b6", "#2ec4b6", "#00a8e8", "#ffffff"],
        });
      }, 250);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const next = flattenedExercises.current[nextIdx];
      if (next.exercise.type === "timed" || next.exercise.type === "rest") {
        setTimeRemaining(next.exercise.duration);
        setMsRemaining(0);
      }
    }
  }, [currentIndex, clearTimer]);

  // Handle circle click
  const handleCircleClick = useCallback(() => {
    if (state === "idle") {
      setState("countdown");
      setCountdownTime(10);
      setMsRemaining(0);
      lastTickRef.current = Date.now();
    } else if (state === "active" && currentExercise?.exercise.type === "numeric") {
      moveToNextExercise();
    } else if (state === "active" || state === "countdown") {
      setIsPaused((prev) => !prev);
    } else if (state === "completed") {
      onComplete();
    }
  }, [state, currentExercise, moveToNextExercise, onComplete]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleCircleClick();
      } else if (e.code === "Escape") {
        clearTimer();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCircleClick, clearTimer, onBack]);

  // High-precision countdown timer
  useEffect(() => {
    if (state === "countdown" && !isPaused) {
      lastTickRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        setMsRemaining((prevMs) => {
          let newMs = prevMs - elapsed;
          if (newMs <= 0) {
            setCountdownTime((prevSec) => {
              if (prevSec <= 1) {
                clearTimer();
                setState("active");
                const first = flattenedExercises.current[0];
                if (first && (first.exercise.type === "timed" || first.exercise.type === "rest")) {
                  setTimeRemaining(first.exercise.duration);
                  setMsRemaining(0);
                }
                return 0;
              }
              return prevSec - 1;
            });
            return 1000 + newMs;
          }
          return newMs;
        });
      }, 50);
    }

    return clearTimer;
  }, [state, isPaused, clearTimer]);

  // High-precision exercise timer
  useEffect(() => {
    if (state === "active" && isTimedExercise && timeRemaining > 0 && !isPaused) {
      lastTickRef.current = Date.now();
      setMsRemaining(1000);

      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - lastTickRef.current;
        lastTickRef.current = now;

        setMsRemaining((prevMs) => {
          let newMs = prevMs - elapsed;
          if (newMs <= 0) {
            setTimeRemaining((prevSec) => {
              if (prevSec <= 1) {
                moveToNextExercise();
                return 0;
              }
              return prevSec - 1;
            });
            return 1000 + newMs;
          }
          return newMs;
        });
      }, 50);
    }

    return clearTimer;
  }, [state, isTimedExercise, timeRemaining, isPaused, moveToNextExercise, clearTimer]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return seconds.toString();
  };

  const getCircleValue = (): string | number => {
    if (state === "idle") return "START";
    if (state === "countdown") return countdownTime;
    if (state === "completed") return "DONE!";

    if (currentExercise?.exercise.type === "numeric") {
      return currentExercise.exercise.count;
    }

    return formatTime(timeRemaining);
  };

  const getCircleSubtext = (): string | undefined => {
    if (state === "idle") return "Click or press SPACE";
    if (state === "countdown") return "Get ready...";
    if (state === "completed") return undefined;

    if (currentExercise?.exercise.type === "numeric") {
      const { name, unit } = currentExercise.exercise;
      return unit ? `${name} (${unit})` : name;
    }

    return undefined;
  };

  const getTotalSeconds = (): number => {
    if (state === "countdown") return 10;
    if (!currentExercise) return 0;
    if (currentExercise.exercise.type === "timed" || currentExercise.exercise.type === "rest") {
      return currentExercise.exercise.duration;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-slate flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <button
          onClick={() => {
            clearTimer();
            onBack();
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-semibold text-white">Workout Timer</h1>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">
        {state === "active" && currentExercise && (
          <ExerciseDisplay
            current={currentExercise}
            next={nextExercise}
            isNumeric={currentExercise.exercise.type === "numeric"}
          />
        )}

        <TimerCircle
          value={getCircleValue()}
          subtext={getCircleSubtext()}
          totalSeconds={getTotalSeconds()}
          remainingSeconds={state === "countdown" ? countdownTime : timeRemaining}
          remainingMs={msRemaining}
          isCountdown={
            state === "countdown" ||
            (state === "active" &&
              (currentExercise?.exercise.type === "timed" ||
                currentExercise?.exercise.type === "rest"))
          }
          isRest={state === "active" && isRest}
          isPaused={isPaused}
          state={state === "completed" ? "completed" : state === "idle" ? "start" : "active"}
          onClick={handleCircleClick}
        />

        {state === "completed" && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Workout Complete! 🎉</h2>
              <p className="text-gray-400">Great job crushing it!</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {!isSaved && (
                <button
                  onClick={onSave}
                  className="px-6 py-3 bg-mint hover:bg-mint/80 text-slate font-semibold 
                           rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save Workout
                </button>
              )}
              <button
                onClick={onComplete}
                className="px-6 py-3 bg-ocean hover:bg-ocean-dark text-white font-semibold 
                         rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer hint */}
      {state !== "completed" && (
        <footer className="p-4 text-center">
          <p className="text-gray-500 text-sm">
            {isPaused ? "Click circle or press SPACE to resume" : "Press ESC to exit • Click circle to pause"}
          </p>
        </footer>
      )}
    </div>
  );
}
