import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatures } from "../hooks/useFeatures.ts";
import { api } from "../lib/api.ts";
import FeatureCard from "../components/FeatureCard.tsx";
import CoverageRadar from "../components/CoverageRadar.tsx";
import CoverageBar from "../components/CoverageBar.tsx";

export default function Dashboard() {
  const { features, loading, error, analyzeFeature, refresh } = useFeatures();
  const navigate = useNavigate();
  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const handleMapFeatures = async () => {
    setMapping(true);
    setMapError(null);
    try {
      await api.mapFeatures();
      await refresh();
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Mapping failed");
    } finally {
      setMapping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading...
      </div>
    );
  }

  if (error || features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-5xl">&#9632;</div>
        <h2 className="text-xl font-semibold text-white">Welcome to AnalyticsMap</h2>
        <p className="text-slate-400 text-center max-w-md">
          Detect features in your project and analyze analytics coverage.
          Click below to start scanning.
        </p>
        {mapError && (
          <div className="text-center">
            <p className="text-red-400 text-sm">{mapError}</p>
            {mapError.includes("500") && (
              <p className="text-slate-500 text-xs mt-1">
                Check that ANTHROPIC_API_KEY is set (source your .env before starting)
              </p>
            )}
          </div>
        )}
        <button
          onClick={handleMapFeatures}
          disabled={mapping}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {mapping ? "Detecting features..." : "Map Features"}
        </button>
        {mapping && (
          <p className="text-slate-500 text-sm">
            AI is analyzing your project structure. This may take a few seconds...
          </p>
        )}
      </div>
    );
  }

  const analyzed = features.filter((f) => f.analysisStatus === "done");
  const totalTracked = analyzed.reduce((sum, f) => sum + f.trackedCount, 0);
  const totalInteractions = analyzed.reduce(
    (sum, f) => sum + f.trackedCount + f.missingCount,
    0
  );
  const overallCoverage =
    totalInteractions > 0
      ? Math.round((totalTracked / totalInteractions) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header stats */}
      <div className="flex items-center gap-8">
        <div className="flex-shrink-0">
          <p className="text-sm text-slate-400 mb-1">Overall Coverage</p>
          <p className="text-5xl font-bold text-white font-mono">
            {analyzed.length > 0 ? `${overallCoverage}%` : "--"}
          </p>
        </div>
        <div className="flex-1 max-w-xs">
          {analyzed.length > 0 && <CoverageBar percent={overallCoverage} showLabel={false} />}
        </div>
        <div className="flex gap-6 text-sm text-slate-400">
          <div>
            <span className="text-white font-semibold">{features.length}</span> features
          </div>
          <div>
            <span className="text-white font-semibold">{totalInteractions}</span> interactions
          </div>
          <div>
            <span className="text-green-400 font-semibold">{totalTracked}</span> tracked
          </div>
          <div>
            <span className="text-red-400 font-semibold">
              {totalInteractions - totalTracked}
            </span>{" "}
            missing
          </div>
        </div>
      </div>

      {/* Radar + Feature grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h2 className="text-sm font-medium text-slate-400 mb-2">
            Coverage by Feature
          </h2>
          <CoverageRadar features={features} />
        </div>

        {/* Feature cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              onAnalyze={() => analyzeFeature(feature.id)}
              onViewEvents={() => navigate(`/events?feature=${encodeURIComponent(feature.name)}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
