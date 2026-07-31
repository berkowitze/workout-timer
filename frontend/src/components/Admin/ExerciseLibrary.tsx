import { useEffect, useState } from "react";
import type { ExerciseLibraryEntry } from "../../types/exerciseLibrary";
import {
  createAdminExercise,
  deleteAdminExercise,
  getAdminExercises,
  updateAdminExercise,
} from "../../api/client";
import { ExerciseFormModal } from "./ExerciseFormModal";

export function ExerciseLibrary() {
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryEntry | null>(null);

  const load = (query?: string) => {
    getAdminExercises(query || undefined)
      .then((data) => setExercises(data))
      .catch((err) => {
        setError("Failed to load exercises.");
        console.error(err);
      });
  };

  useEffect(() => {
    const timeout = setTimeout(() => load(search), 200);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleDelete = async (exercise: ExerciseLibraryEntry) => {
    if (!confirm(`Delete "${exercise.name}"? This can't be undone.`)) return;
    try {
      await deleteAdminExercise(exercise.id);
      load(search);
    } catch (err) {
      setError("Failed to delete exercise.");
      console.error(err);
    }
  };

  return (
    <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg font-semibold text-white">Exercise Library</h2>
        <button
          onClick={() => setIsAddOpen(true)}
          className="px-3 py-1.5 bg-ocean hover:bg-ocean-dark text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          Add Exercise
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or alias..."
        className="w-full mb-3 px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
      />

      {error && <p className="text-coral text-sm mb-2">{error}</p>}

      {exercises === null ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : exercises.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No exercises found.</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Aliases</th>
                <th className="pb-2 font-medium text-center">Equipment</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exercises.map((exercise) => (
                <tr key={exercise.id} className="border-t border-gray-700">
                  <td className="py-2 pr-2 text-white">{exercise.name}</td>
                  <td className="py-2 pr-2 text-gray-400 truncate max-w-[14rem]">
                    {exercise.aliases.join(", ") || "—"}
                  </td>
                  <td className="py-2 text-center">
                    {exercise.needs_equipment ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-coral/20 text-coral">
                        yes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">no</span>
                    )}
                  </td>
                  <td className="py-2 text-right space-x-3">
                    <button
                      onClick={() => setEditing(exercise)}
                      className="text-ocean hover:text-ocean-light transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exercise)}
                      className="text-coral hover:text-coral/80 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAddOpen && (
        <ExerciseFormModal
          title="Add Exercise"
          submitLabel="Add Exercise"
          onClose={() => setIsAddOpen(false)}
          onSubmit={async (payload) => {
            await createAdminExercise(payload);
            load(search);
          }}
        />
      )}

      {editing && (
        <ExerciseFormModal
          title={`Edit ${editing.name}`}
          submitLabel="Save Changes"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            await updateAdminExercise(editing.id, payload);
            load(search);
          }}
        />
      )}
    </div>
  );
}
