import { v4 as uuidv4 } from "uuid";
import type { Exercise, ExerciseWithId } from "../types/workout";

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
