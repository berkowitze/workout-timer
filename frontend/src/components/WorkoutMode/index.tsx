import { useCallback, useMemo, useState } from "react";
import type { Exercise } from "../../types/workout";
import { WorkoutRunner } from "./WorkoutRunner";
import { generateWorkoutName, saveWorkout, startAttempt, updateAttempt } from "../../api/client";
import { ShareLinkBox } from "../ShareLinkBox";
import { AuthForm } from "../AuthForm";
import { stashPendingAction } from "../../utils/pendingAction";
import { flattenExercises } from "../../utils/exercises";
import { calculateTotalTime } from "../../utils/time";
import { getAnonymousId } from "../../utils/anonymousId";

interface WorkoutModeProps {
  exercises: Exercise[];
  onBack: () => void;
  initialSavedId?: string | null;
  isAuthenticated: boolean;
  onAuthenticated: (token: string) => void;
}

export function WorkoutMode({
  exercises,
  onBack,
  initialSavedId,
  isAuthenticated,
  onAuthenticated,
}: WorkoutModeProps) {
  const [isSaved, setIsSaved] = useState(!!initialSavedId);
  const [savedId, setSavedId] = useState<string | null>(initialSavedId ?? null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const flatExercises = useMemo(() => flattenExercises(exercises), [exercises]);
  const totalExercises = flatExercises.length;
  const numericExerciseCount = flatExercises.filter(
    (item) => item.exercise.type === "numeric"
  ).length;
  const expectedDurationSeconds = useMemo(() => calculateTotalTime(exercises), [exercises]);

  // Attempt tracking is analytics only: every call is fire-and-forget so a
  // failed or slow tracking request is completely invisible to the person
  // working out. An ad-hoc run straight from the editor (no savedId) has no
  // workout_id to attach an attempt to, so it's skipped entirely.
  const handleWorkoutStart = useCallback(() => {
    if (!savedId) return;
    startAttempt(savedId, {
      total_exercises: totalExercises,
      numeric_exercise_count: numericExerciseCount,
      expected_duration_seconds: expectedDurationSeconds,
      ...(isAuthenticated ? {} : { anonymous_id: getAnonymousId() }),
    })
      .then((res) => setAttemptId(res.id))
      .catch(() => {});
  }, [savedId, totalExercises, numericExerciseCount, expectedDurationSeconds, isAuthenticated]);

  const handleWorkoutProgress = useCallback(
    (exercisesCompleted: number) => {
      if (!attemptId) return;
      updateAttempt(attemptId, { exercises_completed: exercisesCompleted }).catch(() => {});
    },
    [attemptId]
  );

  const handleWorkoutComplete = useCallback(
    (durationSeconds: number) => {
      if (!attemptId) return;
      updateAttempt(attemptId, {
        status: "completed",
        duration_seconds: durationSeconds,
        exercises_completed: totalExercises,
      }).catch(() => {});
    },
    [attemptId, totalExercises]
  );

  const handleSaveClick = async () => {
    setShowSaveModal(true);
    // A guest can't use this AI call either, so skip straight to a blank
    // field instead of firing a request that's guaranteed to 401.
    if (!workoutName && isAuthenticated) {
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

  const runSave = async () => {
    if (!workoutName.trim()) return;
    setIsSaving(true);
    try {
      const saved = await saveWorkout(workoutName, exercises);
      setSavedId(saved.id);
      setIsSaved(true);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!workoutName.trim()) return;
    if (!isAuthenticated) {
      setNeedsAccount(true);
      return;
    }
    await runSave();
  };

  const handleGateAuthenticated = (token: string) => {
    onAuthenticated(token);
    setNeedsAccount(false);
    runSave();
  };

  const handleBeforeGoogleRedirect = () => {
    stashPendingAction({ type: "save", name: workoutName, exercises });
  };

  return (
    <>
      <WorkoutRunner
        exercises={exercises}
        onComplete={onBack}
        onBack={onBack}
        isSaved={isSaved}
        onSave={handleSaveClick}
        onStart={handleWorkoutStart}
        onProgress={handleWorkoutProgress}
        onWorkoutComplete={handleWorkoutComplete}
      />

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-light border border-gray-600 rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-600">
              <h3 className="text-lg font-semibold text-white">
                {needsAccount ? "Create a free account" : isSaved ? "Workout Saved" : "Save Workout"}
              </h3>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setNeedsAccount(false);
                }}
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

            {needsAccount ? (
              <div className="p-4 pt-2">
                <p className="text-gray-400 text-sm mb-4">
                  Saving gets you a shareable link, and that takes a free account. Sign up or log
                  in below and we'll save it right after.
                </p>
                <AuthForm
                  onAuthenticated={handleGateAuthenticated}
                  onBeforeGoogleRedirect={handleBeforeGoogleRedirect}
                />
              </div>
            ) : isSaved && savedId ? (
              <>
                <div className="p-4 space-y-3">
                  <p className="text-gray-400 text-sm">Share this link so anyone can start it:</p>
                  <ShareLinkBox workoutId={savedId} />
                </div>
                <div className="p-4 border-t border-gray-600">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="w-full py-2 bg-mint hover:bg-mint/80 text-slate font-medium
                             rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
