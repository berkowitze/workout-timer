import type { Exercise } from "../types/workout";

// An action a guest tried to take that needed an account, stashed right
// before a full-page Google OAuth redirect (which wipes all React state) so
// it can be resumed once they're back and authenticated.
export type PendingAction =
  | { type: "parse"; text: string }
  | { type: "save"; name: string; exercises: Exercise[] }
  | { type: "generateName"; name: string; exercises: Exercise[] };

const STORAGE_KEY = "pending_action";

export function stashPendingAction(action: PendingAction): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

export function consumePendingAction(): PendingAction | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as PendingAction;
  } catch {
    return null;
  }
}
