import { useState } from "react";

interface WorkoutParserProps {
  onParse: (text: string) => Promise<void>;
  isLoading: boolean;
}

export function WorkoutParser({ onParse, isLoading }: WorkoutParserProps) {
  const [text, setText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      await onParse(text);
    }
  };

  const placeholder = `Write or paste your workout description here, e.g.:

3 rounds:
30 situps
20 air squats

Then, rest 1 minute

Then, 3 rounds:
20 pushups
1 minute plank hold

2 minutes rowing to cash-out`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="workout-text" className="block text-sm font-medium text-gray-300 mb-2">
          Workout Description
        </label>
        <textarea
          id="workout-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-64 px-4 py-3 bg-slate-light border border-gray-600 rounded-lg 
                     text-white placeholder-gray-500 focus:outline-none focus:ring-2 
                     focus:ring-ocean focus:border-transparent resize-none font-mono text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !text.trim()}
        className="w-full py-3 px-6 bg-ocean hover:bg-ocean-dark disabled:bg-gray-600 
                   disabled:cursor-not-allowed text-white font-semibold rounded-lg 
                   transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
            Parsing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Parse
          </>
        )}
      </button>
    </form>
  );
}
