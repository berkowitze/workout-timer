import { useState } from "react";
import type { Exercise } from "../../types/workout";
import { WorkoutRunner } from "./WorkoutRunner";
import { generateWorkoutName, saveWorkout } from "../../api/client";

interface WorkoutModeProps {
  exercises: Exercise[];
  onBack: () => void;
  initialSavedId?: string | null;
}

export function WorkoutMode({ exercises, onBack, initialSavedId }: WorkoutModeProps) {
  const [isSaved, setIsSaved] = useState(!!initialSavedId);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingName, setIsGeneratingName] = useState(false);

  const handleSaveClick = async () => {
    setShowSaveModal(true);
    if (!workoutName) {
      setIsGeneratingName(true);
      try {
        const name = await generateWorkoutName(exercises);
        setWorkoutName(name);
      } catch (err) {
        console.error("Failed to generate name:", err);
      } finally {
        setIsGeneratingName(false);
      }
    }
  };

  const handleSave = async () => {
    if (!workoutName.trim()) return;
    setIsSaving(true);
    try {
      await saveWorkout(workoutName, exercises);
      setIsSaved(true);
      setShowSaveModal(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <WorkoutRunner
        exercises={exercises}
        onComplete={onBack}
        onBack={onBack}
        isSaved={isSaved}
        onSave={handleSaveClick}
      />

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-light border border-gray-600 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <h3 className="text-lg font-semibold text-white">Save Workout</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Workout Name
                </label>
                <input
                  type="text"
                  value={workoutName}
                  onChange={(e) => setWorkoutName(e.target.value)}
                  placeholder={isGeneratingName ? "Generating name..." : "Enter workout name"}
                  disabled={isGeneratingName}
                  className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg 
                           text-white focus:outline-none focus:ring-2 focus:ring-ocean
                           disabled:opacity-50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-600 flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 border border-gray-600 text-gray-300 hover:bg-gray-700 
                         font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !workoutName.trim()}
                className="flex-1 py-2 bg-mint hover:bg-mint/80 disabled:bg-gray-600 
                         text-slate font-medium rounded-lg transition-colors"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
