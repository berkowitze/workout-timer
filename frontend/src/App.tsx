import { useState } from "react";
import type { Exercise, Workout } from "./types/workout";
import { AuthScreen } from "./components/AuthScreen";
import { ConfigurationMode } from "./components/ConfigurationMode";
import { WorkoutMode } from "./components/WorkoutMode";
import { SharedWorkout } from "./components/SharedWorkout";
import { AdminDashboard } from "./components/Admin";
import { logout } from "./api/client";
import { type PendingAction, consumePendingAction } from "./utils/pendingAction";

type AppMode = "config" | "workout" | "auth" | "share" | "admin";

function parseSharedWorkoutId(): string | null {
  const match = window.location.pathname.match(/^\/w\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

function isAdminPath(): boolean {
  return /^\/admin\/?$/.test(window.location.pathname);
}

// Consumes a ?token= query param left by the Google OAuth redirect (which can
// land while any mode is showing, since login is no longer a forced first
// screen — so this can't live inside AuthScreen, which may never mount for a
// guest) plus whatever action was stashed in sessionStorage right before that
// redirect. Called once, from initial state, so the app never paints an
// unauthenticated flash before settling.
function readOAuthRedirect(): { isAuthenticated: boolean; pendingAction: PendingAction | null } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    window.history.replaceState({}, "", window.location.pathname);
    sessionStorage.setItem("auth_token", token);
  }

  return {
    isAuthenticated: !!sessionStorage.getItem("auth_token"),
    pendingAction: consumePendingAction(),
  };
}

function App() {
  const [oauthState] = useState(readOAuthRedirect);
  const [mode, setMode] = useState<AppMode>(() => {
    if (parseSharedWorkoutId()) return "share";
    if (isAdminPath()) {
      if (oauthState.isAuthenticated) return "admin";
      // Not authenticated - don't even flash the admin route, bounce to "/".
      window.history.replaceState({}, "", "/");
    }
    return "config";
  });
  const [sharedWorkoutId] = useState<string | null>(() => parseSharedWorkoutId());
  const [isAuthenticated, setIsAuthenticated] = useState(oauthState.isAuthenticated);
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem("is_admin") === "1");
  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>([]);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [storedExercises, setStoredExercises] = useState<Exercise[]>([]);
  const [initialWorkout, setInitialWorkout] = useState<
    { name: string; exercises: Exercise[] } | undefined
  >();
  const [autoResumeAction, setAutoResumeAction] = useState<PendingAction | undefined>(
    oauthState.pendingAction ?? undefined
  );

  const handleAuthenticated = (token: string) => {
    sessionStorage.setItem("auth_token", token);
    setIsAuthenticated(true);
    setMode("config");
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  const handleGoToAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setMode("admin");
  };

  const handleLeaveAdmin = () => {
    window.history.pushState({}, "", "/");
    setMode("config");
  };

  const handleAdminUnauthorized = () => {
    window.history.replaceState({}, "", "/");
    setMode("config");
  };

  const handleConfirmedAdmin = () => {
    sessionStorage.setItem("is_admin", "1");
    setIsAdmin(true);
  };

  const handleStartWorkout = (exercises: Exercise[]) => {
    setWorkoutExercises(exercises);
    setStoredExercises(exercises);
    setSavedWorkoutId(null);
    setMode("workout");
  };

  const handleBackToConfig = () => {
    setMode("config");
    // Keep storedExercises so they persist in config mode
  };

  const handleStartFromShare = (workout: Workout) => {
    setWorkoutExercises(workout.exercises);
    setStoredExercises(workout.exercises);
    setSavedWorkoutId(workout.id);
    setMode("workout");
  };

  const handleRemixFromShare = (workout: Workout) => {
    setInitialWorkout({ name: workout.name, exercises: workout.exercises });
    window.history.pushState({}, "", "/");
    setMode("config");
  };

  if (mode === "auth") {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (mode === "admin") {
    return (
      <AdminDashboard
        onUnauthorized={handleAdminUnauthorized}
        onBack={handleLeaveAdmin}
        onConfirmedAdmin={handleConfirmedAdmin}
      />
    );
  }

  if (mode === "share" && sharedWorkoutId) {
    return (
      <SharedWorkout
        workoutId={sharedWorkoutId}
        onStart={handleStartFromShare}
        onRemix={handleRemixFromShare}
      />
    );
  }

  if (mode === "workout" && workoutExercises.length > 0) {
    return (
      <WorkoutMode
        exercises={workoutExercises}
        onBack={handleBackToConfig}
        initialSavedId={savedWorkoutId}
        isAuthenticated={isAuthenticated}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <ConfigurationMode
      onStartWorkout={handleStartWorkout}
      initialExercises={storedExercises}
      initialWorkout={initialWorkout}
      isAuthenticated={isAuthenticated}
      autoResumeAction={autoResumeAction}
      onAutoResumeActionConsumed={() => setAutoResumeAction(undefined)}
      onAuthenticated={handleAuthenticated}
      onRequestLogin={() => setMode("auth")}
      onLogout={handleLogout}
      isAdmin={isAdmin}
      onGoToAdmin={handleGoToAdmin}
    />
  );
}

export default App;
