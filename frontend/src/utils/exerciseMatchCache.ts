import type { ExerciseMatch } from "../types/exerciseLibrary";

// Module-level (not React state) so it survives across ExerciseListView
// mounts/unmounts for the lifetime of the tab - e.g. flipping between the
// config screen's View/Edit toggle re-mounts the component but shouldn't
// re-fetch names already resolved earlier in the session.
const cache = new Map<string, ExerciseMatch | null>();

export function getCachedMatches(names: string[]): {
  cached: Record<string, ExerciseMatch | null>;
  missing: string[];
} {
  const cached: Record<string, ExerciseMatch | null> = {};
  const missing: string[] = [];
  for (const name of names) {
    if (cache.has(name)) {
      cached[name] = cache.get(name) ?? null;
    } else {
      missing.push(name);
    }
  }
  return { cached, missing };
}

export function setCachedMatches(matches: Record<string, ExerciseMatch | null>): void {
  for (const [name, match] of Object.entries(matches)) {
    cache.set(name, match);
  }
}
