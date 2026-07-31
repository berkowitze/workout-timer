import { AuthForm } from "./AuthForm";

interface AccountGateModalProps {
  message: string;
  onAuthenticated: (token: string) => void;
  onClose: () => void;
  onBeforeGoogleRedirect?: () => void;
}

export function AccountGateModal({
  message,
  onAuthenticated,
  onClose,
  onBeforeGoogleRedirect,
}: AccountGateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-light border border-gray-600 rounded-xl max-w-sm w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <h3 className="text-lg font-semibold text-white">Create a free account</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
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

        <div className="p-6 pt-4">
          <p className="text-gray-400 text-sm mb-6">{message}</p>
          <AuthForm onAuthenticated={onAuthenticated} onBeforeGoogleRedirect={onBeforeGoogleRedirect} />
        </div>
      </div>
    </div>
  );
}
