import axios from "axios";
import type { Exercise, Workout } from "../types/workout";
import type {
  AdminAttempt,
  AdminSummary,
  AdminTimeseriesPoint,
  AdminWorkoutSummary,
  TimeseriesMetric,
  WorkoutsSort,
} from "../types/admin";
import type {
  ExerciseLibraryEntry,
  ExerciseMatchResponse,
  UnmatchedExerciseTerm,
} from "../types/exerciseLibrary";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("auth_token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export interface ParseWorkoutResult {
  exercises: Exercise[];
  sessionId: string;
}

export async function parseWorkout(
  text: string,
  options?: { currentExercises?: Exercise[]; sessionId?: string }
): Promise<ParseWorkoutResult> {
  const response = await api.post<{ exercises: Exercise[]; session_id: string }>(
    "/parse-workout",
    {
      text,
      current_exercises: options?.currentExercises,
      session_id: options?.sessionId,
    }
  );
  return { exercises: response.data.exercises, sessionId: response.data.session_id };
}

export async function generateWorkoutName(exercises: Exercise[]): Promise<string> {
  const response = await api.post<{ name: string }>("/generate-name", { exercises });
  return response.data.name;
}

export async function listWorkouts(): Promise<Workout[]> {
  const response = await api.get<Workout[]>("/workouts");
  return response.data;
}

export async function getWorkout(id: string): Promise<Workout> {
  const response = await api.get<Workout>(`/workouts/${id}`);
  return response.data;
}

export async function saveWorkout(name: string, exercises: Exercise[]): Promise<Workout> {
  const response = await api.post<Workout>("/workouts", { name, exercises });
  return response.data;
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const response = await api.post<{ token: string }>("/auth/login", { email, password });
  return response.data;
}

export async function register(email: string, password: string): Promise<{ token: string }> {
  const response = await api.post<{ token: string }>("/auth/register", { email, password });
  return response.data;
}

export function logout(): void {
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("is_admin");
}

interface StartAttemptPayload {
  total_exercises: number;
  numeric_exercise_count: number;
  expected_duration_seconds?: number | null;
  anonymous_id?: string;
}

export async function startAttempt(
  workoutId: string,
  payload: StartAttemptPayload
): Promise<{ id: string }> {
  const response = await api.post<{ id: string }>(`/workouts/${workoutId}/attempts`, payload);
  return response.data;
}

interface UpdateAttemptPayload {
  exercises_completed?: number;
  status?: "started" | "completed";
  duration_seconds?: number;
}

export async function updateAttempt(
  attemptId: string,
  payload: UpdateAttemptPayload
): Promise<void> {
  await api.patch(`/attempts/${attemptId}`, payload);
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const response = await api.get<AdminSummary>("/admin/summary");
  return response.data;
}

export async function getAdminTimeseries(
  metric: TimeseriesMetric,
  days = 30
): Promise<AdminTimeseriesPoint[]> {
  const response = await api.get<AdminTimeseriesPoint[]>("/admin/timeseries", {
    params: { metric, days },
  });
  return response.data;
}

export async function getAdminWorkouts(
  sort: WorkoutsSort = "popularity",
  limit = 50
): Promise<AdminWorkoutSummary[]> {
  const response = await api.get<AdminWorkoutSummary[]>("/admin/workouts", {
    params: { sort, limit },
  });
  return response.data;
}

export async function getAdminWorkoutAttempts(workoutId: string): Promise<AdminAttempt[]> {
  const response = await api.get<AdminAttempt[]>(`/admin/workouts/${workoutId}/attempts`);
  return response.data;
}

export async function matchExercises(names: string[]): Promise<ExerciseMatchResponse> {
  const response = await api.post<ExerciseMatchResponse>("/exercises/match", { names });
  return response.data;
}

export interface ExercisePayload {
  name: string;
  aliases: string[];
  description?: string | null;
  video_url?: string | null;
  needs_equipment: boolean;
}

export async function getAdminExercises(search?: string): Promise<ExerciseLibraryEntry[]> {
  const response = await api.get<ExerciseLibraryEntry[]>("/admin/exercises", {
    params: search ? { search } : undefined,
  });
  return response.data;
}

export async function createAdminExercise(
  payload: ExercisePayload
): Promise<ExerciseLibraryEntry> {
  const response = await api.post<ExerciseLibraryEntry>("/admin/exercises", payload);
  return response.data;
}

export async function updateAdminExercise(
  id: string,
  payload: ExercisePayload
): Promise<ExerciseLibraryEntry> {
  const response = await api.put<ExerciseLibraryEntry>(`/admin/exercises/${id}`, payload);
  return response.data;
}

export async function deleteAdminExercise(id: string): Promise<void> {
  await api.delete(`/admin/exercises/${id}`);
}

export async function getAdminUnmatchedTerms(resolved = false): Promise<UnmatchedExerciseTerm[]> {
  const response = await api.get<UnmatchedExerciseTerm[]>("/admin/exercises/unmatched", {
    params: { resolved },
  });
  return response.data;
}

export type ResolveUnmatchedTermPayload =
  | { action: "alias"; exercise_id: string }
  | (ExercisePayload & { action: "create" });

export async function resolveUnmatchedTerm(
  id: string,
  payload: ResolveUnmatchedTermPayload
): Promise<ExerciseLibraryEntry> {
  const response = await api.post<ExerciseLibraryEntry>(
    `/admin/exercises/unmatched/${id}/resolve`,
    payload
  );
  return response.data;
}
