import { useState, useMemo, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Exercise, ExerciseWithId, Workout } from "../../types/workout";
import { parseWorkout, generateWorkoutName, saveWorkout } from "../../api/client";
import { WorkoutParser } from "./WorkoutParser";
import { ExerciseList } from "./ExerciseList";
import { ExerciseListView } from "./ExerciseListView";
import { WorkoutSelector } from "./WorkoutSelector";
import { AddExerciseModal } from "./AddExerciseModal";

interface ConfigurationModeProps {
  onStartWorkout: (exercises: Exercise[]) => void;
  initialExercises?: Exercise[];
}

function addIdsToExercises(exercises: Exercise[]): ExerciseWithId[] {
  return exercises.map((exercise) => {
    if (exercise.type === "loop") {
      return {
        ...exercise,
        id: uuidv4(),
        exercises: addIdsToExercises(exercise.exercises),
      };
    }
    return {
      ...exercise,
      id: uuidv4(),
    };
  }) as ExerciseWithId[];
}

function omit<T, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([key]) => !keys.includes(key as K))
  ) as Omit<T, K>;
}

function removeIdsFromExercises(exercises: ExerciseWithId[]): Exercise[] {
  return exercises.map((exercise) => {
    if (exercise.type === "loop") {
      const rest = omit(exercise, "id");
      return {
        ...rest,
        exercises: removeIdsFromExercises(exercise.exercises),
      };
    }
    const rest = omit(exercise, "id");
    return rest;
  }) as Exercise[];
}

function calculateTotalTime(exercises: ExerciseWithId[]): number | null {
  let total = 0;
  let allTimed = true;

  for (const ex of exercises) {
    if (ex.type === "timed" || ex.type === "rest") {
      total += ex.duration;
    } else if (ex.type === "loop") {
      const loopTime = calculateTotalTime(ex.exercises);
      if (loopTime === null) {
        allTimed = false;
      } else {
        total += loopTime * ex.rounds;
      }
    } else {
      allTimed = false;
    }
  }

  return allTimed && exercises.length > 0 ? total : null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function ConfigurationMode({ onStartWorkout, initialExercises }: ConfigurationModeProps) {
  const [exercises, setExercises] = useState<ExerciseWithId[]>(() =>
    initialExercises ? addIdsToExercises(initialExercises) : []
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [addToLoopId, setAddToLoopId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const exercisesPanelRef = useRef<HTMLDivElement>(null);

  const totalTime = useMemo(() => calculateTotalTime(exercises), [exercises]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleParse = async (text: string) => {
    setIsParsing(true);
    setError(null);
    try {
      const parsed = await parseWorkout(text);
      const withIds = addIdsToExercises(parsed);
      setExercises(withIds);
      setSavedWorkoutId(null);
      setHasChanges(true);
      // Auto-expand all loops in parsed workout
      const loopIds = new Set<string>();
      const findLoops = (exs: ExerciseWithId[]) => {
        for (const ex of exs) {
          if (ex.type === "loop") {
            loopIds.add(ex.id);
            findLoops(ex.exercises);
          }
        }
      };
      findLoops(withIds);
      setExpandedIds(loopIds);
      setIsViewMode(true); // Switch to view mode after parsing

      // Scroll to exercises panel on narrow screens
      if (window.innerWidth < 1024 && exercisesPanelRef.current) {
        setTimeout(() => {
          exercisesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (err) {
      setError("Failed to parse workout. Please try again.");
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadWorkout = (workout: Workout) => {
    const withIds = addIdsToExercises(workout.exercises);
    setExercises(withIds);
    setWorkoutName(workout.name);
    setSavedWorkoutId(workout.id);
    setHasChanges(false);
    // Auto-expand all loops
    const loopIds = new Set<string>();
    const findLoops = (exs: ExerciseWithId[]) => {
      for (const ex of exs) {
        if (ex.type === "loop") {
          loopIds.add(ex.id);
          findLoops(ex.exercises);
        }
      }
    };
    findLoops(withIds);
    setExpandedIds(loopIds);
    setIsViewMode(true); // Switch to view mode after loading
  };

  const handleExercisesChange = (newExercises: ExerciseWithId[]) => {
    setExercises(newExercises);
    setHasChanges(true);
  };

  const handleAddExercise = (exercise: ExerciseWithId, autoExpand?: boolean) => {
    if (addToLoopId) {
      // Add to specific loop
      const addToLoop = (items: ExerciseWithId[]): ExerciseWithId[] => {
        return items.map((ex) => {
          if (ex.id === addToLoopId && ex.type === "loop") {
            return { ...ex, exercises: [...ex.exercises, exercise] };
          }
          if (ex.type === "loop") {
            return { ...ex, exercises: addToLoop(ex.exercises) };
          }
          return ex;
        });
      };
      setExercises(addToLoop(exercises));
      setAddToLoopId(null);
    } else {
      setExercises([...exercises, exercise]);
    }
    setHasChanges(true);
    if (autoExpand) {
      setExpandedIds((prev) => new Set([...prev, exercise.id]));
    }
  };

  const handleAddToLoop = (loopId: string) => {
    setAddToLoopId(loopId);
    setModalKey((k) => k + 1);
    setIsAddModalOpen(true);
    // Also expand the loop so user sees the new exercise
    setExpandedIds((prev) => new Set([...prev, loopId]));
  };

  const handleGenerateName = async () => {
    if (exercises.length === 0) return;
    setIsGeneratingName(true);
    try {
      const name = await generateWorkoutName(removeIdsFromExercises(exercises));
      setWorkoutName(name);
    } catch (err) {
      console.error("Failed to generate name:", err);
    } finally {
      setIsGeneratingName(false);
    }
  };

  const handleSave = async () => {
    if (!workoutName.trim() || exercises.length === 0) {
      setError("Please enter a workout name and add at least one exercise.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await saveWorkout(workoutName, removeIdsFromExercises(exercises));
      setSavedWorkoutId(saved.id);
      setHasChanges(false);
    } catch (err) {
      setError("Failed to save workout. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStart = () => {
    if (exercises.length > 0) {
      onStartWorkout(removeIdsFromExercises(exercises));
    }
  };

  const canSave = exercises.length > 0 && workoutName.trim() && (hasChanges || !savedWorkoutId);

  return (
    <div className="min-h-screen bg-slate">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Workout Timer</h1>
          <p className="text-gray-400">Create, customize, and crush your workouts</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr_1fr]">
          {/* Left Column - Input */}
          <div className="space-y-4">
            <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-3">Create Workout</h2>
              <WorkoutParser onParse={handleParse} isLoading={isParsing} />
            </div>

            <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
              <WorkoutSelector onSelect={handleLoadWorkout} />
            </div>
          </div>

          {/* Middle Column - Exercise List */}
          <div
            ref={exercisesPanelRef}
            className="bg-slate-light rounded-xl p-5 border border-gray-700"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <h2 className="text-lg font-semibold text-white">Exercises</h2>
                {totalTime !== null && (
                  <span className="text-sm text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded w-fit">
                    {formatDuration(totalTime)} total
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Add button - only in edit mode */}
                {!isViewMode && (
                  <button
                    onClick={() => {
                      setModalKey((k) => k + 1);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-sm text-ocean hover:text-ocean-light transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add
                  </button>
                )}
                {/* View/Edit Toggle */}
                {exercises.length > 0 && (
                  <div className="flex rounded-lg border border-gray-600 overflow-hidden">
                    <button
                      onClick={() => setIsViewMode(true)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        isViewMode ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      View
                    </button>
                    <button
                      onClick={() => setIsViewMode(false)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        !isViewMode ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
                      }`}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {isViewMode ? (
                <ExerciseListView exercises={exercises} />
              ) : (
                <ExerciseList
                  exercises={exercises}
                  onChange={handleExercisesChange}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  onAddToLoop={handleAddToLoop}
                />
              )}
            </div>
          </div>

          {/* Right Column - Save & Start */}
          <div className="space-y-4">
            {exercises.length > 0 ? (
              <div className="bg-slate-light rounded-xl p-5 border border-gray-700 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Workout Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={workoutName}
                      onChange={(e) => {
                        setWorkoutName(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Enter workout name..."
                      className="flex-1 px-3 py-2 bg-slate border border-gray-600 rounded-lg 
                                 text-white focus:outline-none focus:ring-2 focus:ring-ocean text-sm"
                    />
                    <button
                      onClick={handleGenerateName}
                      disabled={isGeneratingName}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 
                                 text-white rounded-lg transition-colors"
                      title="Generate name with AI"
                    >
                      {isGeneratingName ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-2 bg-coral/20 border border-coral/50 rounded-lg text-coral text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  className="w-full py-2.5 px-4 bg-mint hover:bg-mint/80 disabled:bg-gray-600 
                             disabled:cursor-not-allowed text-slate font-semibold rounded-lg 
                             transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : savedWorkoutId && !hasChanges ? (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Saved
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                        />
                      </svg>
                      Save as Shared
                    </>
                  )}
                </button>

                <button
                  onClick={handleStart}
                  className="w-full py-3 px-4 bg-ocean hover:bg-ocean-dark text-white 
                             font-semibold rounded-lg transition-colors flex items-center 
                             justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Start Workout
                </button>
              </div>
            ) : (
              <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
                <p className="text-gray-500 text-sm text-center">Add exercises to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddExerciseModal
        key={modalKey}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddToLoopId(null);
        }}
        onAdd={handleAddExercise}
      />
    </div>
  );
}
