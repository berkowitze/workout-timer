export interface AdminVolumeStats {
  total: number;
  last_7d: number;
  last_30d: number;
}

export interface AdminProgressBucket {
  bucket: string;
  count: number;
}

export interface AdminDurationComparison {
  sample_count: number;
  avg_actual_seconds: number | null;
  avg_expected_seconds: number | null;
  avg_ratio: number | null;
}

export interface AdminSummary {
  volume: {
    workouts: AdminVolumeStats;
    users: AdminVolumeStats;
    attempts: AdminVolumeStats;
  };
  completion_rate: number | null;
  progress_distribution: AdminProgressBucket[];
  duration_comparison: AdminDurationComparison;
  audience: {
    authenticated_attempts: number;
    guest_attempts: number;
    returning_guests: number;
  };
}

export type TimeseriesMetric = "signups" | "workouts" | "attempts";

export interface AdminTimeseriesPoint {
  date: string;
  count: number;
}

export type WorkoutsSort = "popularity" | "recent";

export interface AdminWorkoutSummary {
  id: string;
  name: string;
  created_at: string | null;
  attempt_count: number;
}

export interface AdminAttempt {
  id: string;
  workout_id: string;
  user_id: string | null;
  anonymous_id: string | null;
  status: string;
  total_exercises: number;
  numeric_exercise_count: number;
  exercises_completed: number;
  expected_duration_seconds: number | null;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  user_email: string | null;
}
