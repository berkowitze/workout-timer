interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
}

const VIEW_W = 600;
const VIEW_H = 180;
const CHART_BOTTOM = 150;

export function BarChart({ data, color = "#0077b6" }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barSlot = VIEW_W / data.length;
  const barWidth = barSlot * 0.6;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img">
        <line
          x1={0}
          y1={CHART_BOTTOM}
          x2={VIEW_W}
          y2={CHART_BOTTOM}
          stroke="#334155"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (CHART_BOTTOM - 28);
          const x = i * barSlot + (barSlot - barWidth) / 2;
          const y = CHART_BOTTOM - barHeight;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={3} />
              {d.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize="16"
                  fill="#94a3b8"
                >
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex">
        {data.map((d) => (
          <div key={d.label} style={{ width: `${100 / data.length}%` }} className="text-center">
            <span className="text-[10px] text-gray-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
