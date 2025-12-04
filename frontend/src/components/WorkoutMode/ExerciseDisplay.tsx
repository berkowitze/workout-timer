import { useEffect, useState } from "react";
import type { FlattenedExercise } from "../../types/workout";

interface ExerciseDisplayProps {
  current: FlattenedExercise | null;
  next: FlattenedExercise | null;
  isNumeric?: boolean;
}

function formatExercise(item: FlattenedExercise): string {
  const { exercise, loopInfo } = item;

  let text = "";

  if (exercise.type === "rest") {
    text = "REST";
  } else if (exercise.type === "timed") {
    text = `${exercise.duration}s ${exercise.name.toUpperCase()}`;
    if (exercise.instruction) {
      text += ` - ${exercise.instruction}`;
    }
  } else if (exercise.type === "numeric") {
    text = `${exercise.count} ${exercise.name.toUpperCase()}`;
    if (exercise.unit) {
      text += ` (${exercise.unit})`;
    }
    if (exercise.instruction) {
      text += ` - ${exercise.instruction}`;
    }
  }

  if (loopInfo) {
    text = `[Round ${loopInfo.round}/${loopInfo.totalRounds}] ${text}`;
  }

  return text;
}

export function ExerciseDisplay({ current, next, isNumeric }: ExerciseDisplayProps) {
  const [animateNext, setAnimateNext] = useState(false);
  const [prevCurrentId, setPrevCurrentId] = useState<string | null>(null);

  // Detect exercise change and trigger animation
  useEffect(() => {
    const currentId = current
      ? `${current.exercise.type}-${current.loopInfo?.round || 0}`
      : null;

    if (prevCurrentId !== null && currentId !== prevCurrentId) {
      setAnimateNext(true);
      const timer = setTimeout(() => setAnimateNext(false), 500);
      return () => clearTimeout(timer);
    }

    setPrevCurrentId(currentId);
  }, [current, prevCurrentId]);

  return (
    <div className="text-center space-y-6 w-full max-w-xl">
      {/* Current exercise */}
      {current && (
        <div className={animateNext ? "animate-exercise-pop" : ""}>
          <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Current</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white">{formatExercise(current)}</h2>
        </div>
      )}

      {/* Next exercise */}
      {next && (
        <div className="pt-4 border-t border-gray-700">
          <p className="text-gray-500 text-sm uppercase tracking-wider mb-2">Next</p>
          <p className="text-xl text-gray-400">{formatExercise(next)}</p>
        </div>
      )}

      {/* Space instruction for numeric exercises */}
      {isNumeric && (
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
            <kbd className="px-3 py-1 bg-gray-700 rounded text-white font-mono text-sm">SPACE</kbd>
            <span className="text-gray-400">to continue</span>
          </div>
        </div>
      )}
    </div>
  );
}
