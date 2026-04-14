import type { FeatureData } from "../lib/api.ts";

function coverageColor(percent: number, analyzed: boolean): string {
  if (!analyzed) return "bg-slate-600";
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function coverageTextColor(percent: number, analyzed: boolean): string {
  if (!analyzed) return "text-slate-500";
  if (percent >= 80) return "text-green-400";
  if (percent >= 50) return "text-yellow-400";
  return "text-red-400";
}

export default function CoverageRadar({ features }: { features: FeatureData[] }) {
  if (features.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No features detected yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {features.map((f) => {
        const analyzed = f.analysisStatus === "done";
        const total = f.trackedCount + f.missingCount;

        return (
          <div key={f.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300 flex items-center gap-1.5">
                <span>{f.icon}</span>
                <span>{f.name}</span>
              </span>
              <span className={`font-mono text-xs ${coverageTextColor(f.coveragePercent, analyzed)}`}>
                {analyzed ? `${f.coveragePercent}% (${f.trackedCount}/${total})` : "---"}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${coverageColor(f.coveragePercent, analyzed)}`}
                style={{ width: analyzed ? `${f.coveragePercent}%` : "0%" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
