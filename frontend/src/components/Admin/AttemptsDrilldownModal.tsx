import { useEffect, useState } from "react";
import type { AdminAttempt } from "../../types/admin";
import { getAdminWorkoutAttempts } from "../../api/client";
import { formatDuration } from "../../utils/time";

interface AttemptsDrilldownModalProps {
  workoutId: string;
  workoutName: string;
  onClose: () => void;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function whoLabel(attempt: AdminAttempt): string {
  if (attempt.user_email) return attempt.user_email;
  if (attempt.anonymous_id) return `Guest (${attempt.anonymous_id.slice(0, 8)})`;
  return "Guest";
}

export function AttemptsDrilldownModal({
  workoutId,
  workoutName,
  onClose,
}: AttemptsDrilldownModalProps) {
  const [attempts, setAttempts] = useState<AdminAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminWorkoutAttempts(workoutId)
      .then((data) => {
        if (!cancelled) setAttempts(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError("Failed to load attempts.");
          console.error(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-600 shrink-0">
          <h3 className="text-lg font-semibold text-white truncate pr-4">{workoutName}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar">
          {error && <p className="text-coral text-sm">{error}</p>}
          {!error && attempts === null && <p className="text-gray-500 text-sm">Loading…</p>}
          {attempts && attempts.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">No attempts yet.</p>
          )}
          {attempts && attempts.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="pb-2 font-medium">Who</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Progress</th>
                  <th className="pb-2 font-medium text-right">Duration</th>
                  <th className="pb-2 font-medium text-right">Started</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-t border-gray-700">
                    <td className="py-2 pr-2 text-gray-300 truncate max-w-[10rem]">
                      {whoLabel(attempt)}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          attempt.status === "completed"
                            ? "bg-mint/20 text-mint"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {attempt.status}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-300">
                      {attempt.exercises_completed}/{attempt.total_exercises}
                    </td>
                    <td className="py-2 text-right text-gray-300">
                      {attempt.duration_seconds !== null
                        ? formatDuration(attempt.duration_seconds)
                        : "—"}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {formatWhen(attempt.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
