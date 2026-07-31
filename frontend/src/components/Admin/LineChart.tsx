interface LineChartProps {
  data: { date: string; count: number }[];
  color?: string;
}

const VIEW_W = 600;
const VIEW_H = 180;
const PAD = 12;

function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[Number(month) - 1]} ${Number(day)}`;
}

export function LineChart({ data, color = "#2ec4b6" }: LineChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? (VIEW_W - PAD * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: VIEW_H - PAD - (d.count / max) * (VIEW_H - PAD * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const lastPoint = points[points.length - 1];
  const areaPath =
    points.length > 0
      ? `${linePath} L ${lastPoint.x} ${VIEW_H - PAD} L ${PAD} ${VIEW_H - PAD} Z`
      : "";

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img">
        <line
          x1={PAD}
          y1={VIEW_H - PAD}
          x2={VIEW_W - PAD}
          y2={VIEW_H - PAD}
          stroke="#334155"
          strokeWidth={1}
        />
        {points.length > 0 && (
          <>
            <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}
        {points.map(
          (p, i) =>
            data[i].count > 0 && <circle key={data[i].date} cx={p.x} cy={p.y} r={3} fill={color} />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
        <span>{data[0] ? formatShortDate(data[0].date) : ""}</span>
        <span className="text-gray-400 font-medium">{total} total</span>
        <span>{data[data.length - 1] ? formatShortDate(data[data.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}
