import { useState } from "react";
import type { Exercise } from "./types/workout";
import { ConfigurationMode } from "./components/ConfigurationMode";
import { WorkoutMode } from "./components/WorkoutMode";

type AppMode = "config" | "workout" | "auth";

function App() {
  const [mode, setMode] = useState<AppMode>(() => {
    const token = sessionStorage.getItem("auth_token");
    return token ? "config" : "auth";
  });
  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>([]);
  const [savedWorkoutId] = useState<string | null>(null);
  const [storedExercises, setStoredExercises] = useState<Exercise[]>([]);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem("auth_token", data.token);
        setMode("config");
        setAuthError("");
      } else {
        setAuthError("Invalid password");
      }
    } catch {
      setAuthError("Failed to authenticate");
    }
  };

  const handleStartWorkout = (exercises: Exercise[]) => {
    setWorkoutExercises(exercises);
    setStoredExercises(exercises);
    setMode("workout");
  };

  const handleBackToConfig = () => {
    setMode("config");
    // Keep storedExercises so they persist in config mode
  };

  // Auth screen
  if (mode === "auth") {
    return (
      <div className="min-h-screen bg-slate flex items-center justify-center p-4">
        <div className="bg-slate-light rounded-xl p-8 border border-gray-700 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Workout Timer</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-3 bg-slate border border-gray-600 rounded-lg 
                           text-white focus:outline-none focus:ring-2 focus:ring-ocean"
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {authError && <p className="text-coral text-sm text-center">{authError}</p>}
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-ocean hover:bg-ocean-dark text-white font-semibold 
                         rounded-lg transition-colors"
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "workout" && workoutExercises.length > 0) {
    return (
      <WorkoutMode
        exercises={workoutExercises}
        onBack={handleBackToConfig}
        initialSavedId={savedWorkoutId}
      />
    );
  }

  return (
    <ConfigurationMode onStartWorkout={handleStartWorkout} initialExercises={storedExercises} />
  );
}

export default App;
