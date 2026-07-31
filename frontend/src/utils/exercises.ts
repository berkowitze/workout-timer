import { v4 as uuidv4 } from "uuid";
import type { Exercise, ExerciseWithId, FlattenedExercise } from "../types/workout";

export function flattenExercises(
  exercises: Exercise[],
  loopInfo?: { round: number; totalRounds: number }
): FlattenedExercise[] {
  return exercises.flatMap((exercise) => {
    if (exercise.type === "loop") {
      return Array.from({ length: exercise.rounds }, (_, i) =>
        flattenExercises(exercise.exercises, {
          round: i + 1,
          totalRounds: exercise.rounds,
        })
      ).flat();
    }
    return [{ exercise, loopInfo }];
  });
}

export function addIdsToExercises(exercises: Exercise[]): ExerciseWithId[] {
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
