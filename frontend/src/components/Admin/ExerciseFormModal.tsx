import { useState } from "react";
import type { ExercisePayload } from "../../api/client";
import { useCloseOnEscape } from "../../utils/useCloseOnEscape";

interface ExerciseFormModalProps {
  title: string;
  submitLabel: string;
  initial?: Partial<ExercisePayload>;
  onClose: () => void;
  onSubmit: (payload: ExercisePayload) => Promise<void>;
}

export function ExerciseFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: ExerciseFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [aliases, setAliases] = useState<string[]>(initial?.aliases ?? []);
  const [aliasInput, setAliasInput] = useState("");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [needsEquipment, setNeedsEquipment] = useState(initial?.needs_equipment ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useCloseOnEscape(onClose);

  const addAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setAliases([...aliases, trimmed]);
    }
    setAliasInput("");
  };

  const removeAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        aliases,
        description: description.trim() || null,
        video_url: videoUrl.trim() || null,
        needs_equipment: needsEquipment,
      });
      onClose();
    } catch (err) {
      setError("Failed to save exercise. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
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

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sit-ups"
              className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Aliases</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-200 text-xs rounded"
                >
                  {alias}
                  <button
                    onClick={() => removeAlias(alias)}
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlias();
                }
              }}
              onBlur={addAlias}
              placeholder="Type a spelling variant, press Enter"
              className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short how-to cue shown in the info popover"
              className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Video URL</label>
            <input
              type="text"
              value={videoUrl ?? ""}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/..."
              className="w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={needsEquipment}
              onChange={(e) => setNeedsEquipment(e.target.checked)}
              className="rounded border-gray-600 bg-slate text-ocean focus:ring-ocean"
            />
            Needs equipment
          </label>

          {error && (
            <div className="p-2 bg-coral/20 border border-coral/50 rounded-lg text-coral text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-600">
          <button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
            className="w-full py-2.5 bg-ocean hover:bg-ocean-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
