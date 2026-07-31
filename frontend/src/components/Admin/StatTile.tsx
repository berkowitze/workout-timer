interface StatTileProps {
  label: string;
  value: string | number;
  subvalue?: string;
}

export function StatTile({ label, value, subvalue }: StatTileProps) {
  return (
    <div className="bg-slate-light rounded-xl p-5 border border-gray-700">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subvalue && <p className="text-xs text-gray-500 mt-1">{subvalue}</p>}
    </div>
  );
}
