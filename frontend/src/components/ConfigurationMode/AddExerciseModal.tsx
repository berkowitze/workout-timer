import { useState, useEffect } from "react";
import type { ExerciseWithId } from "../../types/workout";
import { PRESET_EXERCISES } from "../../types/workout";
import { v4 as uuidv4 } from "uuid";
import {
  ExerciseTypeSelector,
  ExerciseFields,
  type ExerciseFormData,
  type ExerciseType,
} from "./ExerciseTypeSelector";

interface AddExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (exercise: ExerciseWithId, autoExpand?: boolean) => void;
  hideLoopOption?: boolean;
}

export function AddExerciseModal({
  isOpen,
  onClose,
  onAdd,
  hideLoopOption,
}: AddExerciseModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ExerciseType>(null);
  const [formData, setFormData] = useState<ExerciseFormData>({
    type: "timed",
    name: "",
    duration: 30,
    count: 20,
    rounds: 3,
    unit: "",
    instruction: "",
  });

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLoop = selectedType === "loop";
  const isRest = selectedType === "rest";

  const handlePresetSelect = (presetName: string) => {
    const preset = PRESET_EXERCISES.find((p) => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      if (preset.type === "rest") {
        setSelectedType("rest");
        setFormData((prev) => ({
          ...prev,
          type: "rest",
          duration: preset.duration,
        }));
      } else if (preset.type === "timed") {
        setSelectedType("timed");
        setFormData((prev) => ({
          ...prev,
          type: "timed",
          name: preset.name,
          duration: preset.duration,
        }));
      } else {
        setSelectedType("numeric");
        setFormData((prev) => ({
          ...prev,
          type: "numeric",
          name: preset.name,
          count: preset.count,
          unit: preset.unit || "",
        }));
      }
    }
  };

  const handleTypeSelect = (type: "timed" | "rest" | "numeric" | "loop") => {
    setSelectedType(type);
    setFormData((prev) => ({ ...prev, type }));
    setSelectedPreset(null);
  };

  const handleAdd = () => {
    if (!selectedType) return;

    let exercise: ExerciseWithId;

    if (selectedType === "timed") {
      exercise = {
        id: uuidv4(),
        type: "timed",
        name: formData.name || "exercise",
        duration: formData.duration,
        instruction: formData.instruction || undefined,
      };
    } else if (selectedType === "rest") {
      exercise = {
        id: uuidv4(),
        type: "rest",
        duration: formData.duration,
      };
    } else if (selectedType === "loop") {
      exercise = {
        id: uuidv4(),
        type: "loop",
        rounds: formData.rounds,
        exercises: [],
      };
    } else {
      exercise = {
        id: uuidv4(),
        type: "numeric",
        name: formData.name || "exercise",
        count: formData.count,
        unit: formData.unit || undefined,
        instruction: formData.instruction || undefined,
      };
    }

    onAdd(exercise, selectedType === "loop");
    onClose();
    setSelectedPreset(null);
    setSelectedType(null);
    setFormData({
      type: "timed",
      name: "",
      duration: 30,
      count: 20,
      rounds: 3,
      unit: "",
      instruction: "",
    });
  };

  const handleFormChange = (changes: Partial<ExerciseFormData>) => {
    setFormData((prev) => ({ ...prev, ...changes }));
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
          {/* Quick Add presets - show when no type selected or timed/numeric */}
          {(selectedType === null || selectedType === "timed" || selectedType === "numeric") && (
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

          {/* For loop/rest: Type + value inline */}
          {isLoop || isRest ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[280px]">
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <ExerciseTypeSelector
                  value={selectedType}
                  onChange={handleTypeSelect}
                  hideLoop={hideLoopOption}
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-gray-400 mb-1">
                  {isLoop ? "Rounds" : "Duration (sec)"}
                </label>
                <input
                  type="number"
                  value={isLoop ? formData.rounds : formData.duration}
                  onChange={(e) =>
                    handleFormChange(
                      isLoop
                        ? { rounds: parseInt(e.target.value) || 1 }
                        : { duration: parseInt(e.target.value) || 0 }
                    )
                  }
                  min="1"
                  className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                <ExerciseTypeSelector
                  value={selectedType}
                  onChange={handleTypeSelect}
                  hideLoop={hideLoopOption}
                />
              </div>

              {/* Customization fields - only show when type is selected */}
              {selectedType && (
                <div className="border-t border-gray-600 pt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-3">Customize</label>
                  <ExerciseFields data={formData} onChange={handleFormChange} isModal />
                </div>
              )}
            </>
          )}

          {/* Loop instructions */}
          {isLoop && (
            <p className="text-xs text-gray-500 italic">
              You can add exercises to this loop after creating it
            </p>
          )}
        </div>

        <div className="p-4 border-t border-gray-600">
          <button
            onClick={handleAdd}
            disabled={!selectedType}
            className="w-full py-2.5 bg-ocean hover:bg-ocean-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoop ? "Add Loop" : "Add Exercise"}
          </button>
        </div>
      </div>
    </div>
  );
}
