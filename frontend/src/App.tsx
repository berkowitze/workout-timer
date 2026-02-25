import { useState } from "react";
import type { Exercise } from "./types/workout";
import { AuthScreen } from "./components/AuthScreen";
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

  const handleAuthenticated = (token: string) => {
    sessionStorage.setItem("auth_token", token);
    setMode("config");
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

  if (mode === "auth") {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
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
