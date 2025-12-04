import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { ExerciseWithId } from "../../types/workout";
import { PRESET_EXERCISES } from "../../types/workout";
import { ExerciseTypeSelector, ExerciseFields, TYPE_CONFIG, type ExerciseFormData, type ExerciseType } from "./ExerciseTypeSelector";

interface ExerciseEditorProps {
  exercise: ExerciseWithId;
  onChange: (exercise: ExerciseWithId) => void;
  onRemove: () => void;
  onAddInLoop?: () => void;
  dragHandleProps?: SyntheticListenerMap;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isNested?: boolean;
  depth?: number;
}

// Colors for loop borders based on depth
const LOOP_BORDER_COLORS = [
  "border-purple-500/50",
  "border-blue-500/50",
  "border-emerald-500/50",
  "border-amber-500/50",
];

const LOOP_BADGE_COLORS = [
  "bg-purple-500/20 text-purple-400",
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
];

const LOOP_BUTTON_COLORS = [
  "text-purple-400 hover:text-purple-300",
  "text-blue-400 hover:text-blue-300",
  "text-emerald-400 hover:text-emerald-300",
  "text-amber-400 hover:text-amber-300",
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
  // Convert exercise to form data
  const getFormData = (): ExerciseFormData => ({
    type: exercise.type,
    name: "name" in exercise ? exercise.name : "",
    duration: "duration" in exercise ? exercise.duration : 30,
    count: "count" in exercise ? exercise.count : 20,
    rounds: "rounds" in exercise ? exercise.rounds : 3,
    unit: "unit" in exercise && exercise.unit ? exercise.unit : "",
    instruction: "instruction" in exercise && exercise.instruction ? exercise.instruction : "",
  });

  const handleTypeChange = (newType: ExerciseType) => {
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

  const handleFieldChange = (changes: Partial<ExerciseFormData>) => {
    if (exercise.type === "timed") {
      onChange({
        ...exercise,
        name: changes.name ?? exercise.name,
        duration: changes.duration ?? exercise.duration,
        instruction: changes.instruction || undefined,
      });
    } else if (exercise.type === "rest") {
      onChange({
        ...exercise,
        duration: changes.duration ?? exercise.duration,
      });
    } else if (exercise.type === "numeric") {
      onChange({
        ...exercise,
        name: changes.name ?? exercise.name,
        count: changes.count ?? exercise.count,
        unit: changes.unit || undefined,
        instruction: changes.instruction || undefined,
      });
    } else if (exercise.type === "loop") {
      onChange({
        ...exercise,
        rounds: changes.rounds ?? exercise.rounds,
      });
    }
  };

  const getExerciseLabel = () => {
    switch (exercise.type) {
      case "timed":
        return `${exercise.duration}s ${exercise.name}${exercise.instruction ? ` (${exercise.instruction})` : ""}`;
      case "rest":
        return `${exercise.duration}s`;
      case "numeric":
        return `${exercise.count} ${exercise.name}${exercise.unit ? ` (${exercise.unit})` : ""}${exercise.instruction ? ` - ${exercise.instruction}` : ""}`;
      case "loop":
        return `${exercise.rounds} rounds`;
    }
  };

  const isLoop = exercise.type === "loop";
  const loopBorderColor = getLoopBorderColor(depth);
  const loopBadgeColor = getLoopBadgeColor(depth);
  const loopButtonColor = getLoopButtonColor(depth);

  const typeConfig = TYPE_CONFIG[exercise.type];

  return (
    <div
      className={`bg-slate-light border rounded-lg overflow-hidden ${
        isLoop ? loopBorderColor : "border-gray-600"
      }`}
    >
      {/* Header - clickable to expand (except drag handle and buttons) */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-700/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Drag handle - stop propagation to prevent expand */}
          <div
            className="cursor-grab text-gray-500 hover:text-gray-300 p-1 -m-1 touch-none"
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded shrink-0 ${
              exercise.type === "loop" ? loopBadgeColor : `${typeConfig.bgClass} ${typeConfig.textClass}`
            }`}
          >
            {exercise.type}
          </span>
          <span className="text-white text-sm font-medium break-words">{getExerciseLabel()}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLoop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddInLoop?.();
              }}
              className={`p-1 ${loopButtonColor} transition-colors`}
              title="Add exercise to loop"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="p-1 text-gray-500">
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded editor using shared components */}
      {isExpanded && (
        <div className="px-3 py-3 border-t border-gray-600 space-y-3">
          {/* For loop/rest: Type + value inline */}
          {(exercise.type === "loop" || exercise.type === "rest") ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-400 mb-2">Type</label>
                  <ExerciseTypeSelector
                    value={exercise.type}
                    onChange={handleTypeChange}
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs text-gray-400 mb-1">
                    {exercise.type === "loop" ? "Rounds" : "Duration (sec)"}
                  </label>
                  <input
                    type="number"
                    value={exercise.type === "loop" ? exercise.rounds : exercise.duration}
                    onChange={(e) => handleFieldChange(
                      exercise.type === "loop"
                        ? { rounds: parseInt(e.target.value) || 1 }
                        : { duration: parseInt(e.target.value) || 0 }
                    )}
                    min="1"
                    className="w-full px-2 py-1.5 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                  />
                </div>
              </div>
              {exercise.type === "loop" && exercise.exercises.length === 0 && (
                <p className="text-xs text-gray-500 italic">
                  Drag exercises into the loop or click + to add
                </p>
              )}
            </>
          ) : (
            <>
              {/* Type selector */}
              <div>
                <label className="block text-xs text-gray-400 mb-2">Type</label>
                <ExerciseTypeSelector
                  value={exercise.type}
                  onChange={handleTypeChange}
                />
              </div>

              {/* Fields */}
              <ExerciseFields
                data={getFormData()}
                onChange={handleFieldChange}
                compact
              />
            </>
          )}

          {/* Datalist for preset exercises */}
          <datalist id="preset-exercises">
            {PRESET_EXERCISES.filter((p) => p.type !== "rest").map((preset) => (
              <option key={preset.name} value={preset.name} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
