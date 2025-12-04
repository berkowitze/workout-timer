import { useState } from "react";
import type { ExerciseWithId } from "../../types/workout";
import { PRESET_EXERCISES } from "../../types/workout";
import { v4 as uuidv4 } from "uuid";

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (exercise: ExerciseWithId, autoExpand?: boolean) => void;
}

export function AddExerciseModal({ isOpen, onClose, onAdd }: AddExerciseModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customExercise, setCustomExercise] = useState<{
    type: "timed" | "rest" | "numeric" | "loop";
    name: string;
    duration: number;
    count: number;
    rounds: number;
    unit: string;
    instruction: string;
  }>({
    type: "timed",
    name: "",
    duration: 30,
    count: 20,
    rounds: 3,
    unit: "",
    instruction: "",
  });

  if (!isOpen) return null;

  const isLoop = customExercise.type === "loop";

  const handlePresetSelect = (presetName: string) => {
    const preset = PRESET_EXERCISES.find((p) => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      if (preset.type === "rest") {
        setCustomExercise((prev) => ({
          ...prev,
          type: "rest",
          duration: preset.duration,
        }));
      } else if (preset.type === "timed") {
        setCustomExercise((prev) => ({
          ...prev,
          type: "timed",
          name: preset.name,
          duration: preset.duration,
        }));
      } else {
        setCustomExercise((prev) => ({
          ...prev,
          type: "numeric",
          name: preset.name,
          count: preset.count,
          unit: preset.unit || "",
        }));
      }
    }
  };

  const handleAdd = () => {
    let exercise: ExerciseWithId;

    if (customExercise.type === "timed") {
      exercise = {
        id: uuidv4(),
        type: "timed",
        name: customExercise.name || "exercise",
        duration: customExercise.duration,
        instruction: customExercise.instruction || undefined,
      };
    } else if (customExercise.type === "rest") {
      exercise = {
        id: uuidv4(),
        type: "rest",
        duration: customExercise.duration,
      };
    } else if (customExercise.type === "loop") {
      exercise = {
        id: uuidv4(),
        type: "loop",
        rounds: customExercise.rounds,
        exercises: [],
      };
    } else {
      exercise = {
        id: uuidv4(),
        type: "numeric",
        name: customExercise.name || "exercise",
        count: customExercise.count,
        unit: customExercise.unit || undefined,
        instruction: customExercise.instruction || undefined,
      };
    }

    // Auto-expand loops so user can add exercises
    onAdd(exercise, customExercise.type === "loop");
    onClose();
    setSelectedPreset(null);
    setCustomExercise({
      type: "timed",
      name: "",
      duration: 30,
      count: 20,
      rounds: 3,
      unit: "",
      instruction: "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <h3 className="text-lg font-semibold text-white">Add Exercise</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Only show quick add for non-loop types */}
          {!isLoop && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quick Add</label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_EXERCISES.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset.name)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedPreset === preset.name
                        ? "border-ocean bg-ocean/20 text-ocean-light"
                        : "border-gray-600 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={isLoop ? "" : "border-t border-gray-600 pt-4"}>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isLoop ? "Configure Loop" : "Or Customize"}
            </label>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  value={customExercise.type}
                  onChange={(e) => {
                    setCustomExercise((prev) => ({
                      ...prev,
                      type: e.target.value as "timed" | "rest" | "numeric" | "loop",
                    }));
                    setSelectedPreset(null);
                  }}
                  className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                >
                  <option value="timed">Timed</option>
                  <option value="rest">Rest</option>
                  <option value="numeric">Numeric (Reps)</option>
                  <option value="loop">Loop (Rounds)</option>
                </select>
              </div>

              {customExercise.type !== "rest" && customExercise.type !== "loop" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={customExercise.name}
                    onChange={(e) =>
                      setCustomExercise((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Exercise name"
                    className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                  />
                </div>
              )}

              {(customExercise.type === "timed" || customExercise.type === "rest") && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Duration (seconds)</label>
                  <input
                    type="number"
                    value={customExercise.duration}
                    onChange={(e) =>
                      setCustomExercise((prev) => ({
                        ...prev,
                        duration: parseInt(e.target.value) || 0,
                      }))
                    }
                    min="1"
                    className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                  />
                </div>
              )}

              {customExercise.type === "numeric" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Count</label>
                    <input
                      type="number"
                      value={customExercise.count}
                      onChange={(e) =>
                        setCustomExercise((prev) => ({
                          ...prev,
                          count: parseInt(e.target.value) || 0,
                        }))
                      }
                      min="1"
                      className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Unit (optional)</label>
                    <input
                      type="text"
                      value={customExercise.unit}
                      onChange={(e) =>
                        setCustomExercise((prev) => ({ ...prev, unit: e.target.value }))
                      }
                      placeholder="e.g., meters"
                      className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                    />
                  </div>
                </>
              )}

              {customExercise.type === "loop" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Rounds</label>
                    <input
                      type="number"
                      value={customExercise.rounds}
                      onChange={(e) =>
                        setCustomExercise((prev) => ({
                          ...prev,
                          rounds: parseInt(e.target.value) || 1,
                        }))
                      }
                      min="1"
                      className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                    />
                  </div>
                  <p className="text-xs text-gray-500 italic">
                    After adding, you can drag exercises into the loop or use the + Add button
                  </p>
                </>
              )}

              {customExercise.type !== "rest" && customExercise.type !== "loop" && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Instruction (optional)</label>
                  <input
                    type="text"
                    value={customExercise.instruction}
                    onChange={(e) =>
                      setCustomExercise((prev) => ({ ...prev, instruction: e.target.value }))
                    }
                    placeholder="e.g., one arm out"
                    className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-600">
          <button
            onClick={handleAdd}
            className="w-full py-2 bg-ocean hover:bg-ocean-dark text-white font-medium rounded-lg transition-colors"
          >
            {isLoop ? "Add Loop" : "Add Exercise"}
          </button>
        </div>
      </div>
    </div>
  );
}
