import axios from "axios";
import type { Exercise, Workout } from "../types/workout";

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

export async function parseWorkout(text: string): Promise<Exercise[]> {
  const response = await api.post<{ exercises: Exercise[] }>("/parse-workout", { text });
  return response.data.exercises;
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
