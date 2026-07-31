export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  video_url: string | null;
  needs_equipment: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExerciseMatch {
  exercise_id: string;
  name: string;
  confidence: number;
  needs_equipment: boolean;
  description: string | null;
  video_url: string | null;
}

export type ExerciseMatchResponse = Record<string, ExerciseMatch | null>;

export interface UnmatchedExerciseTerm {
  id: string;
  raw_name: string;
  seen_count: number;
  last_seen_at: string | null;
  resolved: boolean;
}
