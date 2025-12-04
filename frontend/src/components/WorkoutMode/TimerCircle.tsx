import { useMemo } from "react";

interface TimerCircleProps {
  value: string | number;
  subtext?: string;
  totalSeconds?: number;
  remainingSeconds?: number;
  remainingMs?: number;
  isCountdown?: boolean;
  isRest?: boolean;
  isPaused?: boolean;
  state: "start" | "active" | "completed";
  onClick?: () => void;
}

export function TimerCircle({
  value,
  subtext,
  totalSeconds = 0,
  remainingSeconds = 0,
  remainingMs = 0,
  isCountdown = false,
  isRest = false,
  isPaused = false,
  state,
  onClick,
}: TimerCircleProps) {
  // Use ms for smooth continuous progress
  const totalMs = totalSeconds * 1000;
  const currentRemainingMs = remainingSeconds * 1000 + remainingMs;

  const progress = useMemo(() => {
    if (totalMs === 0) return 0;
    const elapsed = totalMs - currentRemainingMs;
    return Math.max(0, Math.min(100, (elapsed / totalMs) * 100));
  }, [totalMs, currentRemainingMs]);

  // Show near end effects when under 10 seconds (including the final second when remainingSeconds is 0)
  const isNearEnd = remainingSeconds < 10 || (remainingSeconds === 10 && remainingMs < 1000);

  // Calculate color based on remaining time
  const circleColor = useMemo(() => {
    if (state === "completed") return "hsl(120, 70%, 45%)"; // Green
    if (state === "start") return "hsl(210, 100%, 45%)"; // Blue
    if (isPaused) return "hsl(45, 90%, 50%)"; // Yellow/amber for paused
    if (!isCountdown) return "hsl(210, 100%, 45%)"; // Blue for non-timed
    if (!isNearEnd) return "hsl(210, 100%, 45%)"; // Blue

    // Interpolate from blue (210) to green (120) over the last 10 seconds
    const remainingInLast10 = currentRemainingMs / 1000;
    const hue = 210 - ((10 - remainingInLast10) / 10) * 90;
    return `hsl(${Math.max(120, Math.min(210, hue))}, 70%, 50%)`;
  }, [state, isCountdown, isNearEnd, currentRemainingMs, isPaused]);

  // Only pulse during active timed exercises (not rest, not idle)
  const animationClass = useMemo(() => {
    if (state === "completed") return "";
    if (state === "start") return "hover:scale-105 transition-transform cursor-pointer";
    if (isPaused) return "cursor-pointer";
    if (isRest) return "cursor-pointer"; // No pulse during rest
    if (!isCountdown) return "cursor-pointer"; // No pulse for numeric
    return "animate-pulse-slow cursor-pointer"; // Always 2 second pulse for timed
  }, [state, isCountdown, isRest, isPaused]);

  const circumference = 2 * Math.PI * 140; // radius = 140

  // Display value - show tenths for timed exercises (not rest) under 10 seconds
  // This includes countdown phase and active timed exercises
  const showDecimals = isNearEnd && isCountdown && !isRest && currentRemainingMs > 0;

  const displayValue = useMemo(() => {
    if (typeof value === "number") {
      // Show decimal in last 10 seconds for timed exercises (not rest)
      if (showDecimals) {
        const tenths = Math.floor(remainingMs / 100);
        return `${value}.${tenths}`;
      }
      return value;
    }
    return value;
  }, [value, remainingMs, showDecimals]);

  return (
    <div className={`relative ${animationClass}`} onClick={onClick}>
      <svg width="320" height="320" viewBox="0 0 320 320" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="160"
          cy="160"
          r="140"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="12"
        />
        {/* Progress circle - continuous sweep */}
        {isCountdown && totalSeconds > 0 && (
          <circle
            cx="160"
            cy="160"
            r="140"
            fill="none"
            stroke={circleColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
            className="transition-[stroke] duration-300 ease-out"
          />
        )}
        {/* Full circle for non-timed or start state */}
        {(!isCountdown || state === "start") && (
          <circle
            cx="160"
            cy="160"
            r="140"
            fill="none"
            stroke={circleColor}
            strokeWidth="12"
            strokeOpacity={0.3}
          />
        )}
      </svg>

      {/* Inner filled circle */}
      <div
        className={`absolute inset-8 rounded-full flex flex-col items-center justify-center`}
        style={{
          backgroundColor: circleColor,
          boxShadow: `0 0 60px ${circleColor}40`,
          transition: "background-color 0.3s ease-out, box-shadow 0.3s ease-out",
        }}
      >
        <span
          className={`font-bold text-white ${
            typeof displayValue === "string" && displayValue.length > 5
              ? "text-4xl"
              : typeof displayValue === "string" && displayValue.length > 4
                ? "text-5xl"
                : "text-7xl"
          }`}
        >
          {displayValue}
        </span>
        {subtext && <span className="text-white/80 text-lg mt-1">{subtext}</span>}
        {isPaused && <span className="text-white/60 text-sm mt-2">PAUSED - Click to resume</span>}
      </div>
    </div>
  );
}
