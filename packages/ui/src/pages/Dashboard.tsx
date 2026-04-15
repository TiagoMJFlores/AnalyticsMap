import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatures } from "../hooks/useFeatures.ts";
import { api, type DetectedProviderData, type HealthReport } from "../lib/api.ts";
import FeatureCard from "../components/FeatureCard.tsx";
import CoverageRadar from "../components/CoverageRadar.tsx";
import CoverageBar from "../components/CoverageBar.tsx";

const PROVIDER_COLORS: Record<string, string> = {
  firebase: "border-orange-500/40 bg-orange-500/5",
  sentry: "border-purple-500/40 bg-purple-500/5",
  posthog: "border-blue-500/40 bg-blue-500/5",
  mixpanel: "border-indigo-500/40 bg-indigo-500/5",
  amplitude: "border-cyan-500/40 bg-cyan-500/5",
  segment: "border-green-500/40 bg-green-500/5",
  "google-analytics": "border-yellow-500/40 bg-yellow-500/5",
  datadog: "border-violet-500/40 bg-violet-500/5",
};

export default function Dashboard() {
  const { features, loading, error, analyzeFeature, refresh } = useFeatures();
  const navigate = useNavigate();
  const [mapping, setMapping] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [providers, setProviders] = useState<DetectedProviderData[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [health, setHealth] = useState<HealthReport | null>(null);

  useEffect(() => {
    api.getProviders()
      .then((data) => { console.log("Providers:", data); setProviders(data); })
      .catch((err) => { console.error("Providers error:", err); })
      .finally(() => setLoadingProviders(false));
    api.getHealthCheck()
      .then((data) => { console.log("Health data:", data); setHealth(data); })
      .catch((err) => { console.error("Health error:", err); });
  }, []);

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

  const detectedProviders = providers.filter((p) => p.detected);

  if (error || features.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8 py-8">
        {/* Providers detected instantly (no API key needed) */}
        {!loadingProviders && detectedProviders.length > 0 && (
          <div className="w-full max-w-2xl">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">Analytics providers detected in your project</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {detectedProviders.map((p) => (
                <div
                  key={p.provider}
                  className={`p-3 rounded-xl border ${PROVIDER_COLORS[p.provider] ?? "border-slate-700 bg-slate-800"}`}
                >
                  <div className="text-lg mb-1">{p.icon}</div>
                  <div className="text-sm font-medium text-slate-200">{p.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {p.usageCount} calls &middot; {p.files.length} files
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loadingProviders && detectedProviders.length === 0 && (
          <div className="w-full max-w-2xl">
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-800 text-center">
              <p className="text-slate-400 text-sm">No analytics providers detected in your project</p>
              <p className="text-slate-500 text-xs mt-1">Supported: Firebase, Sentry, PostHog, Mixpanel, Amplitude, Segment, Google Analytics, Datadog</p>
            </div>
          </div>
        )}

        {/* Health issues */}
        {health && health.issues.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-400">Analytics health</h3>
              <HealthScore score={health.score} />
            </div>
            <div className="space-y-3">
              {health.issues.map((issue) => (
                <HealthIssueCard key={issue.id} issue={issue} />
              ))}
              {health.passed.length > 0 && (
                <div className="space-y-1">
                  {health.passed.map((msg, i) => (
                    <p key={i} className="text-xs text-green-400 flex items-center gap-1.5">
                      <span>{"\u2705"}</span> {msg}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map features CTA */}
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Map your features</h2>
          <p className="text-slate-400 text-center max-w-md">
            Use AI to detect business features and analyze analytics coverage per feature.
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

      {/* Detected providers */}
      {detectedProviders.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {detectedProviders.map((p) => (
            <div
              key={p.provider}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${PROVIDER_COLORS[p.provider] ?? "border-slate-700 bg-slate-800"}`}
            >
              <span>{p.icon}</span>
              <span className="text-slate-200">{p.label}</span>
              <span className="text-slate-500">{p.usageCount} calls</span>
            </div>
          ))}
        </div>
      )}

      {/* Health issues */}
      {health && health.issues.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-400">Analytics health</h3>
            <HealthScore score={health.score} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {health.issues.map((issue) => (
              <HealthIssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}

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

function HealthScore({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-red-400";
  const bg = score >= 80 ? "bg-green-500/10" : score >= 50 ? "bg-yellow-500/10" : "bg-red-500/10";
  return (
    <span className={`px-2.5 py-1 rounded-lg text-sm font-mono font-bold ${color} ${bg}`}>
      {score}/100
    </span>
  );
}

function HealthIssueCard({ issue }: { issue: import("../lib/api.ts").HealthIssue }) {
  const [expanded, setExpanded] = useState(false);

  const severityStyles = {
    error: "border-red-500/30 bg-red-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };
  const severityIcons = {
    error: "\uD83D\uDD34",
    warning: "\uD83D\uDFE1",
    info: "\uD83D\uDD35",
  };

  return (
    <div
      className={`rounded-xl border p-4 cursor-pointer transition-all hover:brightness-110 ${severityStyles[issue.severity]}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm flex-shrink-0">{severityIcons[issue.severity]}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-200">{issue.title}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{issue.description}</p>

          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-1.5">
                <span className="text-xs text-slate-500 flex-shrink-0">Suggestion:</span>
                <p className="text-xs text-slate-300">{issue.suggestion}</p>
              </div>

              {issue.files.length > 0 && (
                <div>
                  <span className="text-xs text-slate-500">Files:</span>
                  {issue.files.map((f) => (
                    <p key={f} className="text-xs font-mono text-slate-400 ml-2">{f}</p>
                  ))}
                </div>
              )}

              {issue.codeExample && (
                <div>
                  <span className="text-xs text-slate-500">Suggested code:</span>
                  <pre className="mt-1 bg-slate-900 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto">
                    {issue.codeExample}
                  </pre>
                </div>
              )}
            </div>
          )}

          {!expanded && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              Click to see suggestion
              <span className="text-[10px]">{"\u25B6"}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
