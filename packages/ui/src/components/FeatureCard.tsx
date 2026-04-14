import CoverageBar from "./CoverageBar.tsx";
import type { FeatureData } from "../lib/api.ts";

export default function FeatureCard({
  feature,
  onAnalyze,
  onViewEvents,
}: {
  feature: FeatureData;
  onAnalyze: () => void;
  onViewEvents: () => void;
}) {
  const isDone = feature.analysisStatus === "done";
  const isAnalyzing = feature.analysisStatus === "analyzing";
  const isError = feature.analysisStatus === "error";
  const total = feature.trackedCount + feature.missingCount;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col gap-3 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>{feature.icon}</span>
          <span>{feature.name}</span>
        </h3>
        <span className="text-xs text-slate-500">{feature.files.length} files</span>
      </div>

      {isDone ? (
        <>
          <CoverageBar percent={feature.coveragePercent} />
          <p className="text-sm text-slate-400">
            {feature.trackedCount}/{total} interactions tracked
            {feature.missingCount > 0 && (
              <span className="text-red-400 ml-1">
                ({feature.missingCount} missing)
              </span>
            )}
          </p>
          <div className="mt-auto flex gap-2">
            <button
              onClick={onViewEvents}
              className="flex-1 py-2 px-4 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              View events
            </button>
            <button
              onClick={onAnalyze}
              className="py-2 px-3 rounded-lg bg-slate-700 text-slate-400 text-sm hover:bg-slate-600 hover:text-slate-200 transition-colors"
              title="Re-analyze"
            >
              &#x21bb;
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center py-4">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <span className="animate-spin">&#9696;</span>
                Analyzing...
              </div>
            ) : isError ? (
              <p className="text-red-400 text-sm">Analysis failed</p>
            ) : (
              <p className="text-slate-500 text-sm">Not analyzed yet</p>
            )}
          </div>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="mt-auto w-full py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? "Analyzing..." : isError ? "Retry" : "Analyze"}
          </button>
        </>
      )}
    </div>
  );
}
