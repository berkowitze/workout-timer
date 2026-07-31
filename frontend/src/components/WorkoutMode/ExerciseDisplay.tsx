import type { Ref } from "react";
import type { FlattenedExercise } from "../../types/workout";

interface CurrentExerciseProps {
  current: FlattenedExercise | null;
  isNumeric?: boolean;
  isCountdown?: boolean;
  sectionRef?: Ref<HTMLDivElement>;
}

interface NextExerciseProps {
  next: FlattenedExercise | null;
}

interface FormattedExercise {
  label: string;
  instruction?: string;
}

function formatExercise(item: FlattenedExercise, showDuration = true): FormattedExercise {
  const { exercise } = item;

  if (exercise.type === "rest") {
    return { label: showDuration ? `${exercise.duration}s REST` : "REST" };
  } else if (exercise.type === "timed") {
    const label = showDuration
      ? `${exercise.duration}s ${exercise.name.toUpperCase()}`
      : exercise.name.toUpperCase();
    return { label, instruction: exercise.instruction };
  } else if (exercise.type === "numeric") {
    let label = `${exercise.count} ${exercise.name.toUpperCase()}`;
    if (exercise.unit) {
      label += ` (${exercise.unit})`;
    }
    return { label, instruction: exercise.instruction };
  }

  return { label: "" };
}

// Generate a unique key for the current exercise to trigger animation on change
function getExerciseKey(item: FlattenedExercise | null): string {
  if (!item) return "none";
  const { exercise, loopInfo } = item;
  return `${exercise.type}-${loopInfo?.round || 0}-${JSON.stringify(exercise)}`;
}

export function CurrentExercise({ current, isNumeric, isCountdown, sectionRef }: CurrentExerciseProps) {
  if (!current) return null;

  const currentKey = getExerciseKey(current);
  const { label, instruction } = formatExercise(current, false);

  return (
    <div ref={sectionRef} className="text-center w-full max-w-2xl scroll-mt-4">
      <div key={currentKey} className="animate-exercise-pop">
        <div className="flex items-center justify-center gap-3 mb-3">
          <p className="text-gray-400 text-sm uppercase tracking-wider">
            {isCountdown ? "Up Next" : "Current"}
          </p>
          {current.loopInfo && (
            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-sm font-medium rounded">
              {current.loopInfo.round}/{current.loopInfo.totalRounds}
            </span>
          )}
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
          {label}
        </h2>
        {instruction && (
          <p className="mt-2 text-base sm:text-lg text-gray-300 font-normal max-w-md mx-auto">
            {instruction}
          </p>
        )}
      </div>

      {/* Space instruction for numeric exercises */}
      {isNumeric && !isCountdown && (
        <div className="mt-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg">
            <kbd className="px-3 py-1 bg-gray-700 rounded text-white font-mono text-sm">SPACE</kbd>
            <span className="text-gray-400">to continue</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function NextExercise({ next }: NextExerciseProps) {
  if (!next) return null;

  const { label, instruction } = formatExercise(next);

  return (
    <div className="text-center w-full max-w-xl">
      <div className="flex items-center justify-center gap-3 mb-2">
        <p className="text-gray-500 text-sm uppercase tracking-wider">Next</p>
        {next.loopInfo && (
          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs font-medium rounded">
            {next.loopInfo.round}/{next.loopInfo.totalRounds}
          </span>
        )}
      </div>
      <p className="text-xl text-gray-400">{label}</p>
      {instruction && <p className="mt-1 text-sm text-gray-500">{instruction}</p>}
    </div>
  );
}
