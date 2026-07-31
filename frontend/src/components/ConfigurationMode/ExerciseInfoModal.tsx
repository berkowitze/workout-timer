import { useCloseOnEscape } from "../../utils/useCloseOnEscape";
import { getYoutubeEmbedUrl } from "../../utils/youtube";

interface ExerciseInfoModalProps {
  name: string;
  description: string | null;
  videoUrl: string | null;
  onClose: () => void;
}

export function ExerciseInfoModal({ name, description, videoUrl, onClose }: ExerciseInfoModalProps) {
  useCloseOnEscape(onClose);
  const embedUrl = videoUrl ? getYoutubeEmbedUrl(videoUrl) : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <h3 className="text-lg font-semibold text-white">{name}</h3>
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

        <div className="p-4 space-y-3">
          {description && <p className="text-gray-300 text-sm">{description}</p>}
          {embedUrl && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                title={name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {!description && !embedUrl && (
            <p className="text-gray-500 text-sm">No details yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
