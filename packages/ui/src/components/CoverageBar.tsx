function coverageColor(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function coverageTextColor(percent: number): string {
  if (percent >= 80) return "text-green-400";
  if (percent >= 50) return "text-yellow-400";
  return "text-red-400";
}

export default function CoverageBar({
  percent,
  showLabel = true,
}: {
  percent: number;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${coverageColor(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-mono font-medium ${coverageTextColor(percent)}`}>
          {percent}%
        </span>
      )}
    </div>
  );
}
