import { useEffect, useState } from "react";
import type { ExerciseWithId } from "../../types/workout";
import type { ExerciseMatch } from "../../types/exerciseLibrary";
import { matchExercises } from "../../api/client";
import { getCachedMatches, setCachedMatches } from "../../utils/exerciseMatchCache";
import { ExerciseInfoModal } from "./ExerciseInfoModal";

interface ExerciseListViewProps {
  exercises: ExerciseWithId[];
}

// Colors for different nesting levels
const DEPTH_LINE_COLORS = [
  "", // depth 0 - no line
  "rgb(168 85 247 / 0.6)", // depth 1 - purple
  "rgb(59 130 246 / 0.6)", // depth 2 - blue
  "rgb(16 185 129 / 0.6)", // depth 3 - emerald
  "rgb(245 158 11 / 0.6)", // depth 4+ - amber
];

function getLineColor(depth: number): string {
  return DEPTH_LINE_COLORS[Math.min(depth, DEPTH_LINE_COLORS.length - 1)];
}

const TYPE_BADGES = {
  loop: { label: "loop", className: "bg-purple-500/20 text-purple-400" },
  rest: { label: "rest", className: "bg-mint/20 text-mint" },
  timed: { label: "timed", className: "bg-ocean/20 text-ocean-light" },
  numeric: { label: "reps", className: "bg-coral/20 text-coral" },
} as const;

function formatExerciseValue(exercise: ExerciseWithId): string {
  switch (exercise.type) {
    case "loop":
      return `${exercise.rounds} round${exercise.rounds !== 1 ? "s" : ""}`;
    case "rest":
      return `${exercise.duration} seconds`;
    case "timed":
      let timedText = `${exercise.duration}s ${exercise.name}`;
      if (exercise.instruction) {
        timedText += ` (${exercise.instruction})`;
      }
      return timedText;
    case "numeric":
      let numericText = `${exercise.count} ${exercise.name}`;
      if (exercise.unit) {
        numericText += ` ${exercise.unit}`;
      }
      if (exercise.instruction) {
        numericText += ` (${exercise.instruction})`;
      }
      return numericText;
  }
}

interface FlatItem {
  exercise: ExerciseWithId;
  depth: number;
}

function flattenExercises(exercises: ExerciseWithId[], depth = 0): FlatItem[] {
  const result: FlatItem[] = [];
  for (const exercise of exercises) {
    result.push({ exercise, depth });
    if (exercise.type === "loop") {
      result.push(...flattenExercises(exercise.exercises, depth + 1));
    }
  }
  return result;
}

// Names of exercises that can carry library info (timed/numeric only - loop
// and rest have no `name`), deduped for the batch match call.
function collectMatchableNames(items: FlatItem[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (item.exercise.type === "timed" || item.exercise.type === "numeric") {
      names.add(item.exercise.name);
    }
  }
  return [...names];
}

function ExerciseItemView({
  item,
  match,
  onShowInfo,
}: {
  item: FlatItem;
  match?: ExerciseMatch | null;
  onShowInfo?: (match: ExerciseMatch) => void;
}) {
  const badge = TYPE_BADGES[item.exercise.type];
  const canHaveInfo = item.exercise.type === "timed" || item.exercise.type === "numeric";

  // Generate vertical lines for each depth level
  // Each item draws lines for its full height - adjacent items at same depth will connect
  const depthLines = [];
  for (let d = 1; d <= item.depth; d++) {
    depthLines.push(
      <div
        key={d}
        className="absolute w-0.5 top-0 bottom-0"
        style={{
          left: `${(d - 1) * 20 + 8}px`,
          backgroundColor: getLineColor(d),
        }}
      />
    );
  }

  return (
    <div className="relative">
      {depthLines}
      <div className="py-1.5" style={{ marginLeft: `${item.depth * 20}px` }}>
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded shrink-0 ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-gray-300 text-sm break-words">
            {formatExerciseValue(item.exercise)}
          </span>
          {canHaveInfo && match && (
            <button
              onClick={() => onShowInfo?.(match)}
              className="text-gray-500 hover:text-ocean-light transition-colors shrink-0"
              aria-label={`Info about ${match.name}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExerciseListView({ exercises }: ExerciseListViewProps) {
  const [matches, setMatches] = useState<Record<string, ExerciseMatch | null>>({});
  const [infoMatch, setInfoMatch] = useState<ExerciseMatch | null>(null);

  const flatItems = flattenExercises(exercises);
  const names = collectMatchableNames(flatItems);
  // Stable dependency for the effect below - the array identity changes
  // every render even when the underlying names don't.
  const namesKey = names.join("|");

  useEffect(() => {
    if (names.length === 0) return;
    const { cached, missing } = getCachedMatches(names);
    if (Object.keys(cached).length > 0) {
      setMatches((prev) => ({ ...prev, ...cached }));
    }
    if (missing.length === 0) return;

    let cancelled = false;
    // Fired non-blocking after the list has already rendered with no icons -
    // never on the critical path for viewing/starting a workout.
    matchExercises(missing)
      .then((result) => {
        if (cancelled) return;
        setCachedMatches(result);
        setMatches((prev) => ({ ...prev, ...result }));
      })
      .catch((err) => console.error("Failed to match exercises:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  if (exercises.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No exercises yet.</p>
      </div>
    );
  }

  return (
    <div>
      {flatItems.map((item) => (
        <ExerciseItemView
          key={item.exercise.id}
          item={item}
          match={
            item.exercise.type === "timed" || item.exercise.type === "numeric"
              ? matches[item.exercise.name]
              : undefined
          }
          onShowInfo={setInfoMatch}
        />
      ))}

      {infoMatch && (
        <ExerciseInfoModal
          name={infoMatch.name}
          description={infoMatch.description}
          videoUrl={infoMatch.video_url}
          onClose={() => setInfoMatch(null)}
        />
      )}
    </div>
  );
}
