// Cleaned and refactored WorkoutRunner component with consistent sub-second display
// --- Notes ---
// • Extracted logic into smaller helpers
// • Normalized countdown formatting to always show tenths under 10 seconds
// • Reduced repeated logic and improved clarity
// • Behavior remains identical unless improved

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import type { Exercise, FlattenedExercise } from "../../types/workout";
import { TimerCircle } from "./TimerCircle";
import { CurrentExercise, NextExercise } from "./ExerciseDisplay";

// -----------------------------
// Constants
// -----------------------------
const COUNTDOWN_DURATION = 10_000; // 10 seconds
const LOW_BEEP_FREQ = 660;
const HIGH_BEEP_FREQ = 880;

// -----------------------------
// Utilities
// -----------------------------
function flattenExercises(
  exercises: Exercise[],
  loopInfo?: { round: number; totalRounds: number }
): FlattenedExercise[] {
  return exercises.flatMap((exercise) => {
    if (exercise.type === "loop") {
      return Array.from({ length: exercise.rounds }, (_, i) =>
        flattenExercises(exercise.exercises, {
          round: i + 1,
          totalRounds: exercise.rounds,
        })
      ).flat();
    }
    return [{ exercise, loopInfo }];
  });
}

// Web Audio beep helper
function createBeep(frequency: number, duration: number, volume = 0.3) {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioCtor();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + duration / 1000);

    setTimeout(() => audioContext.close(), duration + 100);
  } catch {
    // Audio may not be available in all environments
  }
}

// Format time, always showing tenths when < 10 seconds
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;

  if (totalSeconds < 10) {
    const tenths = totalSeconds.toFixed(1); // e.g. 9.3
    return tenths;
  }

  const secs = Math.floor(totalSeconds);
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;

  if (mins > 0) {
    return `${mins}:${remaining.toString().padStart(2, "0")}`;
  }

  return secs.toString();
}

// -----------------------------
// Component
// -----------------------------
export function WorkoutRunner({
  exercises,
  onComplete,
  onBack,
  isSaved,
  onSave,
}: {
  exercises: Exercise[];
  onComplete: () => void;
  onBack: () => void;
  isSaved: boolean;
  onSave: () => void;
}) {
  const [state, setState] = useState<"idle" | "countdown" | "active" | "completed">("idle");
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [pausedAccum, setPausedAccum] = useState(0);
  const [pauseStart, setPauseStart] = useState<number | null>(null);

  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);

  const completionTriggered = useRef(false);
  const beepsPlayed = useRef<Set<number>>(new Set());

  const flat = useMemo(() => flattenExercises(exercises), [exercises]);
  const current = flat[currentIndex] ?? null;
  const next = flat[currentIndex + 1] ?? null;

  const isTimed =
    current && (current.exercise.type === "timed" || current.exercise.type === "rest");
  const isRest = current?.exercise.type === "rest";

  const phaseDuration = useMemo(() => {
    if (state === "countdown") return COUNTDOWN_DURATION;
    if (!current) return 0;
    if (isTimed && "duration" in current.exercise) return current.exercise.duration * 1000;
    return 0;
  }, [state, current, isTimed]);

  // Compute remaining milliseconds
  const getRemaining = useCallback(() => {
    if (!phaseStartTime) return phaseDuration;

    const now = isPaused && pauseStart ? pauseStart : Date.now();
    const elapsed = now - phaseStartTime - pausedAccum;
    return Math.max(0, phaseDuration - elapsed);
  }, [phaseStartTime, pauseStart, pausedAccum, phaseDuration, isPaused]);

  // Confetti burst
  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 100, origin: { y: 0.5 } });
    }, 250);
  }, []);

  // Animation loop
  useEffect(() => {
    if (state === "idle" || state === "completed" || isPaused) return;

    const tickLoop = () => {
      const remaining = getRemaining();

      // Countdown beeps for both countdown phase and timed exercises
      if (!isPaused && (state === "countdown" || (state === "active" && isTimed))) {
        [3, 2, 1].forEach((t) => {
          if (remaining <= t * 1000 && remaining > 0 && !beepsPlayed.current.has(t)) {
            beepsPlayed.current.add(t);
            createBeep(LOW_BEEP_FREQ, 150);
          }
        });
        if (remaining <= 0 && !beepsPlayed.current.has(0)) {
          beepsPlayed.current.add(0);
          createBeep(HIGH_BEEP_FREQ, 200);
        }
      }

      // Transition
      if (remaining <= 0 && !completionTriggered.current) {
        completionTriggered.current = true;

        if (state === "countdown") {
          setState("active");
          setPhaseStartTime(Date.now());
          setPausedAccum(0);
          beepsPlayed.current.clear();
          completionTriggered.current = false;
        } else if (state === "active" && isTimed) {
          if (currentIndex + 1 >= flat.length) {
            setState("completed");
            fireConfetti();
          } else {
            setCurrentIndex((i) => i + 1);
            setPhaseStartTime(Date.now());
            setPausedAccum(0);
            beepsPlayed.current.clear();
            completionTriggered.current = false;
          }
        }
      } else {
        setTick((t) => t + 1);
      }

      raf.current = requestAnimationFrame(tickLoop);
    };

    raf.current = requestAnimationFrame(tickLoop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [state, isPaused, getRemaining, currentIndex, flat.length, fireConfetti, isTimed]);

  // Reset triggers on change
  useEffect(() => {
    completionTriggered.current = false;
    beepsPlayed.current.clear();
  }, [currentIndex, state]);

  // Circle click handler
  const handleClick = useCallback(() => {
    if (state === "idle") {
      setState("countdown");
      setPhaseStartTime(Date.now());
      setPausedAccum(0);
      beepsPlayed.current.clear();
      return;
    }

    if (state === "active" && current?.exercise.type === "numeric") {
      if (currentIndex + 1 >= flat.length) {
        setState("completed");
        fireConfetti();
      } else {
        setCurrentIndex((i) => i + 1);
        setPhaseStartTime(Date.now());
        setPausedAccum(0);
      }
      return;
    }

    if (state === "active" || state === "countdown") {
      if (isPaused) {
        if (pauseStart) setPausedAccum((p) => p + (Date.now() - pauseStart));
        setPauseStart(null);
        setIsPaused(false);
      } else {
        setPauseStart(Date.now());
        setIsPaused(true);
      }
      return;
    }

    if (state === "completed") onComplete();
  }, [state, current, currentIndex, flat.length, pauseStart, isPaused, onComplete, fireConfetti]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleClick();
      }
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClick, onBack]);

  const remainingMs = getRemaining();
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const remainingSubMs = remainingMs % 1000;

  const circleValue = (() => {
    if (state === "idle") return "START";
    if (state === "countdown") return remainingSeconds;
    if (state === "completed") return "DONE!";
    if (current?.exercise.type === "numeric") return current.exercise.count;
    return formatTime(remainingMs);
  })();

  const circleSubtext = (() => {
    if (state === "idle") return "Click or press SPACE";
    if (state === "countdown") return "Get ready...";
    if (state === "completed") return undefined;
    if (current?.exercise.type === "numeric") {
      const { name, unit } = current.exercise;
      return unit ? `${name} (${unit})` : name;
    }
  })();

  return (
    <div className="min-h-screen bg-slate flex flex-col">
      <header className="flex items-center justify-between p-4">
        <button
          onClick={onBack}
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        {(state === "countdown" || state === "active") && current && (
          <CurrentExercise
            current={current}
            isNumeric={current.exercise.type === "numeric"}
            isCountdown={state === "countdown"}
          />
        )}

        <TimerCircle
          value={circleValue}
          subtext={circleSubtext}
          totalSeconds={phaseDuration / 1000}
          remainingSeconds={remainingSeconds}
          remainingMs={remainingSubMs}
          isCountdown={state === "countdown" || (state === "active" && isTimed)}
          isRest={state === "active" && isRest}
          isPaused={isPaused}
          state={state === "completed" ? "completed" : state === "idle" ? "start" : "active"}
          onClick={handleClick}
        />

        {state === "active" && next && <NextExercise next={next} />}

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
                  className="px-6 py-3 bg-mint hover:bg-mint/80 text-slate font-semibold rounded-lg"
                >
                  Save Workout
                </button>
              )}

              <button
                onClick={onComplete}
                className="px-6 py-3 bg-ocean hover:bg-ocean-dark text-white font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </main>

      {state !== "completed" && (
        <footer className="p-4 text-center text-gray-500 text-sm">
          {isPaused
            ? "Click circle or press SPACE to resume"
            : "Press ESC to exit • Click circle to pause"}
        </footer>
      )}
    </div>
  );
}
