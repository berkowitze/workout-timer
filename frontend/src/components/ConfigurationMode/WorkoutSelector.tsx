import { useEffect, useState } from "react";
import type { Workout } from "../../types/workout";
import { listWorkouts } from "../../api/client";

interface WorkoutSelectorProps {
  onSelect: (workout: Workout) => void;
}

export function WorkoutSelector({ onSelect }: WorkoutSelectorProps) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const data = await listWorkouts();
        setWorkouts(data);
      } catch (err) {
        setError("Failed to load workouts");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkouts();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Loading shared workouts...
      </div>
    );
  }

  if (error) {
    return <p className="text-coral text-sm">{error}</p>;
  }

  if (workouts.length === 0) {
    return <p className="text-gray-500 text-sm">No shared workouts yet.</p>;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Load Shared Workout</label>
      <select
        onChange={(e) => {
          const workout = workouts.find((w) => w.id === e.target.value);
          if (workout) {
            onSelect(workout);
          }
        }}
        defaultValue=""
        className="w-full px-3 py-2 bg-slate-light border border-gray-600 rounded-lg 
                   text-white focus:outline-none focus:ring-2 focus:ring-ocean"
      >
        <option value="" disabled>
          Select a workout...
        </option>
        {workouts.map((workout) => (
          <option key={workout.id} value={workout.id}>
            {workout.name}
          </option>
        ))}
      </select>
    </div>
  );
}
