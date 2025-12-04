import type { FlattenedExercise } from "../../types/workout";

interface CurrentExerciseProps {
  current: FlattenedExercise | null;
  isNumeric?: boolean;
  isCountdown?: boolean;
}

interface NextExerciseProps {
  next: FlattenedExercise | null;
}

function formatExerciseName(item: FlattenedExercise, showDuration = true): string {
  const { exercise } = item;

  if (exercise.type === "rest") {
    return showDuration ? `${exercise.duration}s REST` : "REST";
  } else if (exercise.type === "timed") {
    let text = showDuration
      ? `${exercise.duration}s ${exercise.name.toUpperCase()}`
      : exercise.name.toUpperCase();
    if (exercise.instruction) {
      text += ` - ${exercise.instruction}`;
    }
    return text;
  } else if (exercise.type === "numeric") {
    let text = `${exercise.count} ${exercise.name.toUpperCase()}`;
    if (exercise.unit) {
      text += ` (${exercise.unit})`;
    }
    if (exercise.instruction) {
      text += ` - ${exercise.instruction}`;
    }
    return text;
  }

  return "";
}

// Generate a unique key for the current exercise to trigger animation on change
function getExerciseKey(item: FlattenedExercise | null): string {
  if (!item) return "none";
  const { exercise, loopInfo } = item;
  return `${exercise.type}-${loopInfo?.round || 0}-${JSON.stringify(exercise)}`;
}

export function CurrentExercise({ current, isNumeric, isCountdown }: CurrentExerciseProps) {
  if (!current) return null;

  const currentKey = getExerciseKey(current);

  return (
    <div className="text-center w-full max-w-2xl">
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
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
          {formatExerciseName(current, false)}
        </h2>
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
      <p className="text-xl text-gray-400">{formatExerciseName(next)}</p>
    </div>
  );
}
