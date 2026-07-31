import type { AdminWorkoutSummary, WorkoutsSort } from "../../types/admin";

interface WorkoutsTableProps {
  workouts: AdminWorkoutSummary[];
  sort: WorkoutsSort;
  onSortChange: (sort: WorkoutsSort) => void;
  onSelectWorkout: (workout: AdminWorkoutSummary) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WorkoutsTable({
  workouts,
  sort,
  onSortChange,
  onSelectWorkout,
}: WorkoutsTableProps) {
  return (
    <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Workouts</h2>
        <div className="flex rounded-lg border border-gray-600 overflow-hidden">
          <button
            onClick={() => onSortChange("popularity")}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              sort === "popularity" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Popular
          </button>
          <button
            onClick={() => onSortChange("recent")}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              sort === "recent" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {workouts.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No workouts yet.</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right">Attempts</th>
                <th className="pb-2 font-medium text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {workouts.map((workout) => (
                <tr
                  key={workout.id}
                  onClick={() => onSelectWorkout(workout)}
                  className="border-t border-gray-700 cursor-pointer hover:bg-slate/60 transition-colors"
                >
                  <td className="py-2 pr-2 text-white truncate max-w-[16rem]">{workout.name}</td>
                  <td className="py-2 text-right text-gray-300">{workout.attempt_count}</td>
                  <td className="py-2 text-right text-gray-500">
                    {formatDate(workout.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
