import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise, Workout } from "./types/workout";
import { AuthScreen } from "./components/AuthScreen";
import { ConfigurationMode } from "./components/ConfigurationMode";
import { WorkoutMode } from "./components/WorkoutMode";
import { SharedWorkout } from "./components/SharedWorkout";
import { AdminDashboard } from "./components/Admin";
import { logout } from "./api/client";
import { type PendingAction, consumePendingAction } from "./utils/pendingAction";

type AppMode = "config" | "workout" | "auth" | "share" | "admin";

// Tagged onto every history entry we create, so a popstate event can tell us
// which screen to show. `seq` counts how many entries *we've* pushed this
// session — it's how a Back button can tell "there's a previous in-app
// screen" (safe to call history.back()) from "this was the very first thing
// loaded, e.g. a bookmarked /admin link" (nothing to go back to in-app).
interface NavState {
  mode: AppMode;
  seq: number;
}

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

  const navSeqRef = useRef(0);

  // Tag the entry the browser already created for this page load, so it
  // looks like every other entry we push from here on.
  useEffect(() => {
    const state: NavState = { mode, seq: 0 };
    window.history.replaceState(state, "", window.location.pathname);
    // Deliberately runs once on mount to tag the initial entry — not meant
    // to re-tag on every subsequent mode change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors the browser's Back/Forward buttons into `mode`. Every screen
  // change below goes through `navigate`, which pushes a NavState-tagged
  // entry, so popping back to one here is enough to restore that screen —
  // no need to separately track "where did this screen come from".
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as NavState | null;
      if (state && typeof state.mode === "string") {
        navSeqRef.current = state.seq ?? 0;
        setMode(state.mode);
        return;
      }
      // No tagged state — the user navigated somewhere we didn't push
      // (e.g. edited the URL bar). Derive the screen the same way initial
      // load does.
      navSeqRef.current = 0;
      if (parseSharedWorkoutId()) {
        setMode("share");
      } else if (isAdminPath() && isAuthenticated) {
        setMode("admin");
      } else {
        setMode("config");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isAuthenticated]);

  const navigate = useCallback(
    (nextMode: AppMode, path?: string, opts?: { replace?: boolean }) => {
      const url = path ?? window.location.pathname;
      if (opts?.replace) {
        const state: NavState = { mode: nextMode, seq: navSeqRef.current };
        window.history.replaceState(state, "", url);
      } else {
        const seq = navSeqRef.current + 1;
        navSeqRef.current = seq;
        const state: NavState = { mode: nextMode, seq };
        window.history.pushState(state, "", url);
      }
      setMode(nextMode);
    },
    []
  );

  // For "Back"-labeled buttons: prefer a real history pop (so it lines up
  // with the browser's own Back button), but fall back to a fresh push when
  // there's no previous in-app entry to pop to — e.g. a bookmarked /admin
  // link, where history.back() would leave the app entirely.
  const goBack = useCallback(
    (fallbackMode: AppMode, fallbackPath: string) => {
      if (navSeqRef.current > 0) {
        window.history.back();
      } else {
        navigate(fallbackMode, fallbackPath);
      }
    },
    [navigate]
  );

  const handleAuthenticated = (token: string) => {
    sessionStorage.setItem("auth_token", token);
    setIsAuthenticated(true);
    // This also fires from the inline account-gate modal (save/parse while
    // a guest), which happens without ever leaving config/workout mode —
    // only touch navigation when a full-screen login is what's on-screen.
    if (mode === "auth") {
      navigate("config", "/", { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  const handleGoToAdmin = () => {
    navigate("admin", "/admin");
  };

  const handleLeaveAdmin = () => {
    goBack("config", "/");
  };

  const handleAdminUnauthorized = () => {
    navigate("config", "/", { replace: true });
  };

  const handleConfirmedAdmin = () => {
    sessionStorage.setItem("is_admin", "1");
    setIsAdmin(true);
  };

  const handleStartWorkout = (exercises: Exercise[]) => {
    setWorkoutExercises(exercises);
    setStoredExercises(exercises);
    setSavedWorkoutId(null);
    navigate("workout");
  };

  const handleBackToConfig = () => {
    // Goes back to whatever screen preceded the workout — config or share,
    // whichever it actually was — since that's just the previous entry.
    goBack("config", "/");
    // Keep storedExercises so they persist in config mode
  };

  const handleStartFromShare = (workout: Workout) => {
    setWorkoutExercises(workout.exercises);
    setStoredExercises(workout.exercises);
    setSavedWorkoutId(workout.id);
    navigate("workout");
  };

  const handleRemixFromShare = (workout: Workout) => {
    setInitialWorkout({ name: workout.name, exercises: workout.exercises });
    navigate("config", "/");
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
      onRequestLogin={() => navigate("auth")}
      onLogout={handleLogout}
      isAdmin={isAdmin}
      onGoToAdmin={handleGoToAdmin}
    />
  );
}

export default App;
