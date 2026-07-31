import { useEffect, useState } from "react";
import type { ExerciseLibraryEntry, UnmatchedExerciseTerm } from "../../types/exerciseLibrary";
import { getAdminExercises, getAdminUnmatchedTerms, resolveUnmatchedTerm } from "../../api/client";
import { ExerciseFormModal } from "./ExerciseFormModal";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function UnmatchedTermsQueue() {
  const [terms, setTerms] = useState<UnmatchedExerciseTerm[] | null>(null);
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[]>([]);
  const [mappingTermId, setMappingTermId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [creatingTerm, setCreatingTerm] = useState<UnmatchedExerciseTerm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    getAdminUnmatchedTerms(false)
      .then(setTerms)
      .catch((err) => {
        setError("Failed to load unmatched terms.");
        console.error(err);
      });
    getAdminExercises()
      .then(setExercises)
      .catch((err) => console.error(err));
  };

  useEffect(reload, []);

  const handleConfirmAlias = async (term: UnmatchedExerciseTerm) => {
    if (!selectedExerciseId) return;
    try {
      await resolveUnmatchedTerm(term.id, { action: "alias", exercise_id: selectedExerciseId });
      setMappingTermId(null);
      setSelectedExerciseId("");
      reload();
    } catch (err) {
      setError("Failed to map term.");
      console.error(err);
    }
  };

  return (
    <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-1">Unmatched Terms</h2>
      <p className="text-xs text-gray-500 mb-3">
        Exercise names the matcher couldn't resolve, most frequent first
      </p>

      {error && <p className="text-coral text-sm mb-2">{error}</p>}

      {terms === null ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : terms.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Nothing to review right now.</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar space-y-2">
          {terms.map((term) => (
            <div
              key={term.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate rounded-lg border border-gray-700"
            >
              <div className="min-w-0">
                <p className="text-white text-sm truncate">{term.raw_name}</p>
                <p className="text-xs text-gray-500">
                  seen {term.seen_count}× · last {formatWhen(term.last_seen_at)}
                </p>
              </div>

              {mappingTermId === term.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedExerciseId}
                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                    className="px-2 py-1.5 bg-slate-light border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-ocean"
                  >
                    <option value="">Choose exercise…</option>
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleConfirmAlias(term)}
                    disabled={!selectedExerciseId}
                    className="text-xs px-2 py-1.5 bg-mint text-slate font-medium rounded-lg disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setMappingTermId(null)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <button
                    onClick={() => {
                      setMappingTermId(term.id);
                      setSelectedExerciseId("");
                    }}
                    className="text-ocean hover:text-ocean-light transition-colors"
                  >
                    Map to existing
                  </button>
                  <button
                    onClick={() => setCreatingTerm(term)}
                    className="text-mint hover:text-mint/80 transition-colors"
                  >
                    Create new
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creatingTerm && (
        <ExerciseFormModal
          title="Create Exercise"
          submitLabel="Create Exercise"
          initial={{ name: creatingTerm.raw_name, aliases: [], needs_equipment: false }}
          onClose={() => setCreatingTerm(null)}
          onSubmit={async (payload) => {
            await resolveUnmatchedTerm(creatingTerm.id, { ...payload, action: "create" });
            reload();
          }}
        />
      )}
    </div>
  );
}
