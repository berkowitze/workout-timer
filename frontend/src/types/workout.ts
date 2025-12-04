export interface TimedExercise {
  type: "timed";
  name: string;
  duration: number;
  instruction?: string;
}

export interface RestExercise {
  type: "rest";
  duration: number;
}

export interface NumericExercise {
  type: "numeric";
  name: string;
  count: number;
  unit?: string;
  instruction?: string;
}

export interface LoopExercise {
  type: "loop";
  rounds: number;
  exercises: Exercise[];
}

export type Exercise = TimedExercise | RestExercise | NumericExercise | LoopExercise;

// ExerciseWithId preserves all properties and adds an id
export type TimedExerciseWithId = TimedExercise & { id: string };
export type RestExerciseWithId = RestExercise & { id: string };
export type NumericExerciseWithId = NumericExercise & { id: string };
export type LoopExerciseWithId = {
  type: "loop";
  id: string;
  rounds: number;
  exercises: ExerciseWithId[];
};

export type ExerciseWithId =
  | TimedExerciseWithId
  | RestExerciseWithId
  | NumericExerciseWithId
  | LoopExerciseWithId;

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
  created_at?: string;
}

export interface FlattenedExercise {
  exercise: TimedExercise | RestExercise | NumericExercise;
  loopInfo?: {
    round: number;
    totalRounds: number;
  };
}

export const PRESET_EXERCISES = [
  { name: "plank", type: "timed" as const, duration: 30 },
  { name: "pushups", type: "numeric" as const, count: 20 },
  { name: "situps", type: "numeric" as const, count: 30 },
  { name: "squats", type: "numeric" as const, count: 20 },
  { name: "burpees", type: "numeric" as const, count: 10 },
  { name: "lunges", type: "numeric" as const, count: 20 },
  { name: "jumping jacks", type: "numeric" as const, count: 30 },
  { name: "mountain climbers", type: "numeric" as const, count: 20 },
  { name: "high knees", type: "timed" as const, duration: 30 },
  { name: "rest", type: "rest" as const, duration: 60 },
  { name: "row", type: "numeric" as const, count: 500, unit: "meters" },
];
