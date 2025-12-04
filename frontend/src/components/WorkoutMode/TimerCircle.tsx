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
  remainingMs,
  isCountdown = false,
  isRest = false,
  isPaused = false,
  state,
  onClick,
}: TimerCircleProps) {
  const progress = useMemo(() => {
    if (totalSeconds === 0) return 0;
    return ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  }, [totalSeconds, remainingSeconds]);

  const isNearEnd = remainingSeconds <= 10 && remainingSeconds > 0;

  // Calculate color based on remaining time
  const circleColor = useMemo(() => {
    if (state === "completed") return "hsl(120, 70%, 45%)"; // Green
    if (state === "start") return "hsl(210, 100%, 45%)"; // Blue
    if (isPaused) return "hsl(45, 90%, 50%)"; // Yellow/amber for paused
    if (!isCountdown) return "hsl(210, 100%, 45%)"; // Blue for non-timed
    if (!isNearEnd) return "hsl(210, 100%, 45%)"; // Blue

    // Interpolate from blue (210) to green (120) over the last 10 seconds
    const hue = 210 - ((10 - remainingSeconds) / 10) * 90;
    return `hsl(${hue}, 70%, 50%)`;
  }, [state, isCountdown, isNearEnd, remainingSeconds, isPaused]);

  const animationClass = useMemo(() => {
    if (state === "completed") return "";
    if (state === "start") return "hover:scale-105 transition-transform cursor-pointer";
    if (isPaused) return "cursor-pointer";
    if (isRest) return "animate-rest-gradient cursor-pointer";
    if (!isCountdown) return "animate-pulse-slow cursor-pointer";
    return isNearEnd ? "animate-pulse-fast cursor-pointer" : "animate-pulse-slow cursor-pointer";
  }, [state, isCountdown, isNearEnd, isRest, isPaused]);

  const circumference = 2 * Math.PI * 140; // radius = 140

  // Display value with ms when under 10s
  const displayValue = useMemo(() => {
    if (isNearEnd && remainingMs !== undefined && typeof value === "number") {
      const ms = Math.floor(remainingMs / 100);
      return `${value}.${ms}`;
    }
    return value;
  }, [value, remainingMs, isNearEnd]);

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
        {/* Progress circle */}
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
            style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.5s ease-out" }}
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
        className={`absolute inset-8 rounded-full flex flex-col items-center justify-center ${
          isRest && !isPaused ? "animate-rest-gradient-bg" : ""
        }`}
        style={{
          backgroundColor: isRest && !isPaused ? undefined : circleColor,
          boxShadow: `0 0 60px ${circleColor}40`,
          transition: "background-color 0.5s ease-out, box-shadow 0.5s ease-out",
        }}
      >
        <span
          className={`font-bold text-white ${
            typeof displayValue === "string" && displayValue.length > 5
              ? "text-3xl"
              : typeof displayValue === "string" && displayValue.length > 4
                ? "text-4xl"
                : "text-6xl"
          }`}
        >
          {displayValue}
        </span>
        {subtext && <span className="text-white/80 text-lg mt-1">{subtext}</span>}
        {isPaused && (
          <span className="text-white/60 text-sm mt-2">PAUSED - Click to resume</span>
        )}
      </div>
    </div>
  );
}
