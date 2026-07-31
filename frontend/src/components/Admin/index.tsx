import { useEffect, useState } from "react";
import type {
  AdminSummary,
  AdminTimeseriesPoint,
  AdminWorkoutSummary,
  TimeseriesMetric,
  WorkoutsSort,
} from "../../types/admin";
import { getAdminSummary, getAdminTimeseries, getAdminWorkouts } from "../../api/client";
import { formatDuration } from "../../utils/time";
import { StatTile } from "./StatTile";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { WorkoutsTable } from "./WorkoutsTable";
import { AttemptsDrilldownModal } from "./AttemptsDrilldownModal";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { UnmatchedTermsQueue } from "./UnmatchedTermsQueue";

type AdminTab = "analytics" | "exercises";

interface AdminDashboardProps {
  onUnauthorized: () => void;
  onBack: () => void;
  onConfirmedAdmin: () => void;
}

const TIMESERIES_METRICS: { key: TimeseriesMetric; label: string }[] = [
  { key: "attempts", label: "Attempts" },
  { key: "workouts", label: "Workouts Created" },
  { key: "signups", label: "Signups" },
];

function formatPercent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${Math.round(fraction * 100)}%`;
}

export function AdminDashboard({ onUnauthorized, onBack, onConfirmedAdmin }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>("analytics");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [metric, setMetric] = useState<TimeseriesMetric>("attempts");
  const [timeseries, setTimeseries] = useState<AdminTimeseriesPoint[] | null>(null);

  const [sort, setSort] = useState<WorkoutsSort>("popularity");
  const [workouts, setWorkouts] = useState<AdminWorkoutSummary[]>([]);

  const [selectedWorkout, setSelectedWorkout] = useState<AdminWorkoutSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminSummary()
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          onConfirmedAdmin();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          onUnauthorized();
        } else {
          setSummaryError("Failed to load the admin summary.");
          console.error(err);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAdminTimeseries(metric, 30)
      .then((data) => {
        if (!cancelled) setTimeseries(data);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [metric]);

  useEffect(() => {
    let cancelled = false;
    getAdminWorkouts(sort, 50)
      .then((data) => {
        if (!cancelled) setWorkouts(data);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [sort]);

  if (summaryError) {
    return (
      <div className="min-h-screen bg-slate flex items-center justify-center p-4">
        <p className="text-coral text-sm">{summaryError}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-slate flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  const { volume, audience, duration_comparison, progress_distribution } = summary;

  return (
    <div className="min-h-screen bg-slate">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="flex justify-end">
          <button
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back to app
          </button>
        </div>
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Usage, engagement, and content overview</p>
        </header>

        <div className="flex justify-center mb-6">
          <div className="flex rounded-lg border border-gray-600 overflow-hidden">
            <button
              onClick={() => setTab("analytics")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "analytics" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setTab("exercises")}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === "exercises" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Exercises
            </button>
          </div>
        </div>

        {tab === "exercises" ? (
          <div className="space-y-6">
            <ExerciseLibrary />
            <UnmatchedTermsQueue />
          </div>
        ) : (
          <>
        {/* Volume */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatTile
            label="Workouts"
            value={volume.workouts.total}
            subvalue={`+${volume.workouts.last_7d} last 7d`}
          />
          <StatTile
            label="Users"
            value={volume.users.total}
            subvalue={`+${volume.users.last_7d} last 7d`}
          />
          <StatTile
            label="Attempts"
            value={volume.attempts.total}
            subvalue={`+${volume.attempts.last_7d} last 7d`}
          />
          <StatTile label="Completion Rate" value={formatPercent(summary.completion_rate)} />
        </div>

        {/* Growth */}
        <div className="bg-slate-light rounded-xl p-5 border border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-white">Growth (last 30 days)</h2>
            <div className="flex rounded-lg border border-gray-600 overflow-hidden w-fit">
              {TIMESERIES_METRICS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    metric === key ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {timeseries ? (
            <LineChart data={timeseries} />
          ) : (
            <p className="text-gray-500 text-sm">Loading…</p>
          )}
        </div>

        {/* Funnel */}
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] mb-6">
          <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-1">Progress Distribution</h2>
            <p className="text-xs text-gray-500 mb-3">
              How far people get through a workout before stopping
            </p>
            <BarChart
              data={progress_distribution.map((b) => ({ label: b.bucket, value: b.count }))}
            />
          </div>

          <div className="bg-slate-light rounded-xl p-5 border border-gray-700 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Pace Sanity Check</h2>
              <p className="text-xs text-gray-500 mb-3">Actual vs. expected duration</p>
            </div>
            {duration_comparison.sample_count === 0 ? (
              <p className="text-gray-500 text-sm">Not enough data yet.</p>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Expected</span>
                  <span className="text-white">
                    {formatDuration(duration_comparison.avg_expected_seconds ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Actual</span>
                  <span className="text-white">
                    {formatDuration(duration_comparison.avg_actual_seconds ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                  <span className="text-gray-400">Avg. pace</span>
                  <span className="text-white">
                    {Math.round((duration_comparison.avg_ratio ?? 1) * 100)}% of expected
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {duration_comparison.sample_count} attempts with both values recorded
                </p>
              </>
            )}
          </div>
        </div>

        {/* Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatTile label="Authenticated Attempts" value={audience.authenticated_attempts} />
          <StatTile label="Guest Attempts" value={audience.guest_attempts} />
          <StatTile
            label="Returning Guests"
            value={audience.returning_guests}
            subvalue="guests with >1 attempt"
          />
        </div>

        {/* Content */}
        <WorkoutsTable
          workouts={workouts}
          sort={sort}
          onSortChange={setSort}
          onSelectWorkout={setSelectedWorkout}
        />
          </>
        )}
      </div>

      {selectedWorkout && (
        <AttemptsDrilldownModal
          workoutId={selectedWorkout.id}
          workoutName={selectedWorkout.name}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  );
}
