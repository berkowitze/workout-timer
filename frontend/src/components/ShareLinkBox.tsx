import { useState } from "react";

interface ShareLinkBoxProps {
  workoutId: string;
}

export function ShareLinkBox({ workoutId }: ShareLinkBoxProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/w/${workoutId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="flex-1 min-w-0 px-3 py-2 bg-slate border border-gray-600 rounded-lg
                   text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
      />
      <button
        onClick={handleCopy}
        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg
                   transition-colors text-sm font-medium shrink-0"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
