import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "anonymous_id";

// Identifies a returning guest across sessions (localStorage, not
// sessionStorage — needs to survive beyond a single visit) so guest workout
// attempts can be attributed to the same anonymous person, no account or PII.
export function getAnonymousId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
