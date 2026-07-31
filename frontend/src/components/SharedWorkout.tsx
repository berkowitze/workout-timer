import { useEffect, useMemo, useState } from "react";
import type { Workout } from "../types/workout";
import { getWorkout } from "../api/client";
import { ExerciseListView } from "./ConfigurationMode/ExerciseListView";
import { addIdsToExercises } from "../utils/exercises";
import { calculateTotalTime, formatDuration } from "../utils/time";

interface SharedWorkoutProps {
  workoutId: string;
  onStart: (workout: Workout) => void;
  onRemix: (workout: Workout) => void;
}

export function SharedWorkout({ workoutId, onStart, onRemix }: SharedWorkoutProps) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // workoutId is set once by App.tsx and never changes, so the mount-time
    // isLoading/error defaults below cover this without resetting them here.
    let cancelled = false;
    getWorkout(workoutId)
      .then((data) => {
        if (!cancelled) setWorkout(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError("This workout couldn't be found.");
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  const exercisesWithIds = useMemo(
    () => (workout ? addIdsToExercises(workout.exercises) : []),
    [workout]
  );
  const totalTime = useMemo(
    () => (workout ? calculateTotalTime(workout.exercises) : null),
    [workout]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="min-h-screen bg-slate flex items-center justify-center p-4">
        <p className="text-coral text-sm">{error ?? "This workout couldn't be found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate">
      <div className="max-w-xl mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-1">Shared Workout</p>
          <h1 className="text-3xl font-bold text-white mb-2">{workout.name}</h1>
          {totalTime !== null && (
            <span className="text-sm text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded">
              {formatDuration(totalTime)} total
            </span>
          )}
        </header>

        <div className="bg-slate-light rounded-xl p-5 border border-gray-700 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Exercises</h2>
          <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            <ExerciseListView exercises={exercisesWithIds} />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onStart(workout)}
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

          <button
            onClick={() => onRemix(workout)}
            className="w-full py-2.5 px-4 border border-gray-600 hover:border-gray-400
                       text-gray-200 font-medium rounded-lg transition-colors flex items-center
                       justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Remix This Workout
          </button>
        </div>
      </div>
    </div>
  );
}
