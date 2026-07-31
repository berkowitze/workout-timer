import type { Exercise } from "../types/workout";

// Total duration only makes sense when every exercise is time-based — a
// workout with any rep-counted exercise has no fixed length.
export function calculateTotalTime(exercises: Exercise[]): number | null {
  let total = 0;
  let allTimed = true;

  for (const ex of exercises) {
    if (ex.type === "timed" || ex.type === "rest") {
      total += ex.duration;
    } else if (ex.type === "loop") {
      const loopTime = calculateTotalTime(ex.exercises);
      if (loopTime === null) {
        allTimed = false;
      } else {
        total += loopTime * ex.rounds;
      }
    } else {
      allTimed = false;
    }
  }

  return allTimed && exercises.length > 0 ? total : null;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
