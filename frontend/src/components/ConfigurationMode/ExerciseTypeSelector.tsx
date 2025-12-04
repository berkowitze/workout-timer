// Shared exercise type selector and field editors

// Icon components for exercise types (background versions with thick strokes)
export function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function HashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  );
}

export type ExerciseType = "timed" | "rest" | "numeric" | "loop" | null;

export const TYPE_CONFIG = {
  loop: { label: "Loop", icon: RepeatIcon, bgClass: "bg-purple-500/20", borderClass: "border-purple-500", textClass: "text-purple-400" },
  rest: { label: "Rest", icon: MoonIcon, bgClass: "bg-mint/20", borderClass: "border-mint", textClass: "text-mint" },
  timed: { label: "Timed", icon: ClockIcon, bgClass: "bg-ocean/20", borderClass: "border-ocean", textClass: "text-ocean-light" },
  numeric: { label: "Reps", icon: HashIcon, bgClass: "bg-coral/20", borderClass: "border-coral", textClass: "text-coral" },
} as const;

interface TypeSelectorProps {
  value: ExerciseType;
  onChange: (type: "timed" | "rest" | "numeric" | "loop") => void;
  hideLoop?: boolean;
}

export function ExerciseTypeSelector({ value, onChange, hideLoop }: TypeSelectorProps) {
  const typeOptions: ("timed" | "rest" | "numeric" | "loop")[] = hideLoop
    ? ["timed", "numeric", "rest"]
    : ["timed", "numeric", "rest", "loop"];

  return (
    <div className="flex flex-wrap gap-2">
      {typeOptions.map((type) => {
        const config = TYPE_CONFIG[type];
        const Icon = config.icon;
        const isSelected = value === type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`relative flex items-center justify-center min-w-[80px] px-5 py-2.5 rounded-lg border transition-all overflow-hidden basis-[calc(50%-4px)] sm:basis-auto ${
              isSelected
                ? `${config.borderClass} ${config.bgClass} text-white`
                : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
            }`}
          >
            {/* Background icon - centered, fixed opacity */}
            <Icon className="absolute inset-0 m-auto w-10 h-10 opacity-15 text-gray-400" />
            <span className="relative z-10 text-sm font-medium">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Shared form field types
export interface ExerciseFormData {
  type: "timed" | "rest" | "numeric" | "loop";
  name: string;
  duration: number;
  count: number;
  rounds: number;
  unit: string;
  instruction: string;
}

interface ExerciseFieldsProps {
  data: ExerciseFormData;
  onChange: (data: Partial<ExerciseFormData>) => void;
  compact?: boolean;
  isModal?: boolean;
}

export function ExerciseFields({ data, onChange, compact, isModal }: ExerciseFieldsProps) {
  const inputClass = compact
    ? "w-full px-2 py-1.5 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean"
    : "w-full px-3 py-2 bg-slate border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean";

  const labelClass = "block text-xs text-gray-400 mb-1";

  if (data.type === "loop") {
    return (
      <div className="space-y-2">
        <div>
          <label className={labelClass}>Rounds</label>
          <input
            type="number"
            value={data.rounds}
            onChange={(e) => onChange({ rounds: parseInt(e.target.value) || 1 })}
            min="1"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-gray-500 italic">
          {isModal 
            ? "You can add exercises to this loop after creating it"
            : "Drag exercises into the loop or click + to add"}
        </p>
      </div>
    );
  }

  if (data.type === "rest") {
    return (
      <div>
        <label className={labelClass}>Duration (seconds)</label>
        <input
          type="number"
          value={data.duration}
          onChange={(e) => onChange({ duration: parseInt(e.target.value) || 0 })}
          min="1"
          className={inputClass}
        />
      </div>
    );
  }

  if (data.type === "timed") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Exercise name"
            className={inputClass}
            list="preset-exercises"
          />
        </div>
        <div>
          <label className={labelClass}>Duration (seconds)</label>
          <input
            type="number"
            value={data.duration}
            onChange={(e) => onChange({ duration: parseInt(e.target.value) || 0 })}
            min="1"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Instruction (optional)</label>
          <input
            type="text"
            value={data.instruction}
            onChange={(e) => onChange({ instruction: e.target.value })}
            placeholder="e.g., one arm out"
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  // numeric type
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Exercise name"
          className={inputClass}
          list="preset-exercises"
        />
      </div>
      <div>
        <label className={labelClass}>Count</label>
        <input
          type="number"
          value={data.count}
          onChange={(e) => onChange({ count: parseInt(e.target.value) || 0 })}
          min="1"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Unit (optional)</label>
        <input
          type="text"
          value={data.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          placeholder="e.g., meters"
          className={inputClass}
        />
      </div>
      <div className="col-span-2">
        <label className={labelClass}>Instruction (optional)</label>
        <input
          type="text"
          value={data.instruction}
          onChange={(e) => onChange({ instruction: e.target.value })}
          placeholder="e.g., alternating legs"
          className={inputClass}
        />
      </div>
    </div>
  );
}

