import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { ExerciseWithId } from "../../types/workout";
import { PRESET_EXERCISES } from "../../types/workout";
import { v4 as uuidv4 } from "uuid";

interface ExerciseEditorProps {
  exercise: ExerciseWithId;
  onChange: (exercise: ExerciseWithId) => void;
  onRemove: () => void;
  onAddInLoop?: (exercise: ExerciseWithId) => void;
  dragHandleProps?: SyntheticListenerMap;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isNested?: boolean;
  depth?: number;
}

// Colors for loop borders based on depth
const LOOP_BORDER_COLORS = [
  "border-purple-500/50", // depth 0
  "border-blue-500/50", // depth 1
  "border-emerald-500/50", // depth 2
  "border-amber-500/50", // depth 3+
];

const LOOP_BADGE_COLORS = [
  "bg-purple-500/20 text-purple-400", // depth 0
  "bg-blue-500/20 text-blue-400", // depth 1
  "bg-emerald-500/20 text-emerald-400", // depth 2
  "bg-amber-500/20 text-amber-400", // depth 3+
];

const LOOP_BUTTON_COLORS = [
  "text-purple-400 hover:text-purple-300", // depth 0
  "text-blue-400 hover:text-blue-300", // depth 1
  "text-emerald-400 hover:text-emerald-300", // depth 2
  "text-amber-400 hover:text-amber-300", // depth 3+
];

function getLoopBorderColor(depth: number): string {
  return LOOP_BORDER_COLORS[Math.min(depth, LOOP_BORDER_COLORS.length - 1)];
}

function getLoopBadgeColor(depth: number): string {
  return LOOP_BADGE_COLORS[Math.min(depth, LOOP_BADGE_COLORS.length - 1)];
}

function getLoopButtonColor(depth: number): string {
  return LOOP_BUTTON_COLORS[Math.min(depth, LOOP_BUTTON_COLORS.length - 1)];
}

export function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
  onAddInLoop,
  dragHandleProps,
  isExpanded = false,
  onToggleExpand,
  isNested = false,
  depth = 0,
}: ExerciseEditorProps) {
  const handleTypeChange = (newType: string) => {
    if (newType === "timed") {
      onChange({
        id: exercise.id,
        type: "timed",
        name: "name" in exercise ? exercise.name : "exercise",
        duration: "duration" in exercise ? exercise.duration : 30,
        instruction: "instruction" in exercise ? exercise.instruction : undefined,
      });
    } else if (newType === "rest") {
      onChange({
        id: exercise.id,
        type: "rest",
        duration: "duration" in exercise ? exercise.duration : 60,
      });
    } else if (newType === "numeric") {
      onChange({
        id: exercise.id,
        type: "numeric",
        name: "name" in exercise ? exercise.name : "exercise",
        count: "count" in exercise ? exercise.count : 20,
        unit: "unit" in exercise ? exercise.unit : undefined,
        instruction: "instruction" in exercise ? exercise.instruction : undefined,
      });
    } else if (newType === "loop") {
      onChange({
        id: exercise.id,
        type: "loop",
        rounds: "rounds" in exercise ? exercise.rounds : 3,
        exercises: exercise.type === "loop" ? exercise.exercises : [],
      });
    }
  };

  const getExerciseLabel = () => {
    switch (exercise.type) {
      case "timed":
        return `${exercise.duration}s ${exercise.name}${exercise.instruction ? ` (${exercise.instruction})` : ""}`;
      case "rest":
        return `Rest ${exercise.duration}s`;
      case "numeric":
        return `${exercise.count} ${exercise.name}${exercise.unit ? ` (${exercise.unit})` : ""}${exercise.instruction ? ` - ${exercise.instruction}` : ""}`;
      case "loop":
        return `${exercise.rounds} rounds (${exercise.exercises.length} exercises)`;
      default:
        return "Exercise";
    }
  };

  const isLoop = exercise.type === "loop";
  const loopBorderColor = getLoopBorderColor(depth);
  const loopBadgeColor = getLoopBadgeColor(depth);
  const loopButtonColor = getLoopButtonColor(depth);

  return (
    <div
      className={`bg-slate-light border rounded-lg overflow-hidden ${
        isLoop ? loopBorderColor : "border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Drag handle */}
          <div
            className="cursor-grab text-gray-500 hover:text-gray-300 p-1 -m-1 touch-none"
            {...dragHandleProps}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded shrink-0 ${
              exercise.type === "timed"
                ? "bg-ocean/20 text-ocean-light"
                : exercise.type === "rest"
                  ? "bg-mint/20 text-mint"
                  : exercise.type === "loop"
                    ? loopBadgeColor
                    : "bg-coral/20 text-coral"
            }`}
          >
            {exercise.type}
          </span>
          <span className="text-white text-sm font-medium truncate">{getExerciseLabel()}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLoop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newExercise: ExerciseWithId = {
                  id: uuidv4(),
                  type: "numeric",
                  name: "exercise",
                  count: 10,
                };
                if (onAddInLoop) {
                  onAddInLoop(newExercise);
                } else {
                  onChange({
                    ...exercise,
                    exercises: [...exercise.exercises, newExercise],
                  });
                }
              }}
              className={`p-1 ${loopButtonColor} transition-colors`}
              title="Add exercise to loop"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-gray-500 hover:text-coral transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <button
            onClick={onToggleExpand}
            className="p-1 text-gray-500 hover:text-white transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 py-3 border-t border-gray-600 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select
              value={exercise.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
            >
              <option value="timed">Timed</option>
              <option value="rest">Rest</option>
              <option value="numeric">Numeric (Reps)</option>
              {!isNested && <option value="loop">Loop (Rounds)</option>}
            </select>
          </div>

          {(exercise.type === "timed" || exercise.type === "numeric") && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Exercise Name</label>
              <input
                type="text"
                value={exercise.name}
                onChange={(e) =>
                  onChange({ ...exercise, name: e.target.value } as ExerciseWithId)
                }
                className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
                list="preset-exercises"
              />
              <datalist id="preset-exercises">
                {PRESET_EXERCISES.filter((p) => p.type !== "rest").map((preset) => (
                  <option key={preset.name} value={preset.name} />
                ))}
              </datalist>
            </div>
          )}

          {(exercise.type === "timed" || exercise.type === "rest") && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={exercise.duration}
                onChange={(e) =>
                  onChange({
                    ...exercise,
                    duration: parseInt(e.target.value) || 0,
                  } as ExerciseWithId)
                }
                min="1"
                className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
              />
            </div>
          )}

          {exercise.type === "numeric" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Count</label>
                <input
                  type="number"
                  value={exercise.count}
                  onChange={(e) =>
                    onChange({
                      ...exercise,
                      count: parseInt(e.target.value) || 0,
                    } as ExerciseWithId)
                  }
                  min="1"
                  className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Unit (optional)
                </label>
                <input
                  type="text"
                  value={exercise.unit || ""}
                  onChange={(e) =>
                    onChange({
                      ...exercise,
                      unit: e.target.value || undefined,
                    } as ExerciseWithId)
                  }
                  placeholder="e.g., meters, calories"
                  className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
                />
              </div>
            </>
          )}

          {(exercise.type === "timed" || exercise.type === "numeric") && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Instruction (optional)
              </label>
              <input
                type="text"
                value={exercise.instruction || ""}
                onChange={(e) =>
                  onChange({
                    ...exercise,
                    instruction: e.target.value || undefined,
                  } as ExerciseWithId)
                }
                placeholder="e.g., one arm out, alternating legs"
                className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
              />
            </div>
          )}

          {exercise.type === "loop" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Rounds</label>
              <input
                type="number"
                value={exercise.rounds}
                onChange={(e) =>
                  onChange({
                    ...exercise,
                    rounds: parseInt(e.target.value) || 1,
                  } as ExerciseWithId)
                }
                min="1"
                className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ocean"
              />
              {exercise.exercises.length === 0 && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  Drag exercises here or click the + button to add
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
