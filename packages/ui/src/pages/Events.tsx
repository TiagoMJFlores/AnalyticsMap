import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFeatures } from "../hooks/useFeatures.ts";
import { api, type InteractionData, type CodeContextData, type EventFeedbackData, type EventIssueData } from "../lib/api.ts";

const PROVIDER_ICONS: Record<string, string> = {
  firebase: "\uD83D\uDD25",
  sentry: "\uD83D\uDC1B",
  posthog: "\uD83E\uDDA4",
  mixpanel: "\uD83C\uDFB2",
  amplitude: "\uD83D\uDCC8",
  segment: "\uD83D\uDD17",
  "google-analytics": "\uD83D\uDCCA",
  datadog: "\uD83D\uDC36",
  custom: "\u2699\uFE0F",
  unknown: "\u2753",
  none: "\u2796",
};

const PROVIDER_COLORS: Record<string, string> = {
  firebase: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  sentry: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  posthog: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  mixpanel: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  amplitude: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  segment: "bg-green-500/10 text-green-400 border-green-500/30",
  "google-analytics": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  datadog: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  custom: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  unknown: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  none: "bg-slate-600/10 text-slate-500 border-slate-600/30",
};

function ProviderBadge({ provider }: { provider: string }) {
  const icon = PROVIDER_ICONS[provider] ?? "\u2753";
  const color = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.unknown;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${color}`}>
      {icon} {provider}
    </span>
  );
}

export default function Events() {
  const { features, loading } = useFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  const featureFromUrl = searchParams.get("feature");
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFeature, setFilterFeature] = useState<string>(featureFromUrl ?? "all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<Map<string, EventIssueData[]>>(new Map());

  useEffect(() => {
    api.getEventFeedback()
      .then((data) => {
        const map = new Map<string, EventIssueData[]>();
        for (const fb of data) {
          if (fb.issues.length > 0) map.set(fb.interactionId, fb.issues);
        }
        setFeedback(map);
      })
      .catch(() => {});
  }, [features]);

  const allInteractions = useMemo(() => {
    return features.flatMap((f) =>
      (f.interactions ?? []).map((i: InteractionData) => ({
        ...i,
        featureName: f.name,
        featureIcon: f.icon,
      }))
    );
  }, [features]);

  const providers = useMemo(() => {
    const map = new Map<string, { count: number; files: Set<string> }>();
    for (const i of allInteractions) {
      const p = i.detectedProvider ?? "none";
      const entry = map.get(p) ?? { count: 0, files: new Set<string>() };
      entry.count++;
      entry.files.add(i.file);
      map.set(p, entry);
    }
    return Array.from(map.entries())
      .map(([provider, data]) => ({
        provider,
        count: data.count,
        files: data.files.size,
      }))
      .sort((a, b) => b.count - a.count);
  }, [allInteractions]);

  const featureNames = useMemo(() => {
    return [...new Set(allInteractions.map((i) => i.featureName))];
  }, [allInteractions]);

  const filtered = useMemo(() => {
    return allInteractions.filter((i) => {
      if (filterFeature !== "all" && i.featureName !== filterFeature) return false;
      if (filterProvider !== "all" && (i.detectedProvider ?? "none") !== filterProvider) return false;
      if (filterStatus === "tracked" && !i.tracked) return false;
      if (filterStatus === "missing" && i.tracked) return false;
      if (search) {
        const q = search.toLowerCase();
        const eventName = (i.tracked ? i.existingEvent : i.suggestedEvent) ?? "";
        return (
          eventName.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.file.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allInteractions, filterFeature, filterProvider, filterStatus, search]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  }

  if (allInteractions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-400">No events detected yet</p>
        <p className="text-slate-500 text-sm">
          Analyze features from the Dashboard to see events
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {providers.map(({ provider, count, files }) => (
          <button
            key={provider}
            onClick={() => setFilterProvider(filterProvider === provider ? "all" : provider)}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterProvider === provider
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-800 hover:border-slate-600"
            }`}
          >
            <div className="text-lg mb-1">{PROVIDER_ICONS[provider] ?? "\u2753"}</div>
            <div className="text-sm font-medium text-slate-200 capitalize">{provider}</div>
            <div className="text-xs text-slate-400">
              {count} events &middot; {files} files
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={filterFeature}
          onChange={(e) => {
            setFilterFeature(e.target.value);
            setSearchParams(e.target.value !== "all" ? { feature: e.target.value } : {});
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="all">All features</option>
          {featureNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300"
        >
          <option value="all">All status</option>
          <option value="tracked">Tracked only</option>
          <option value="missing">Missing only</option>
        </select>
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-500"
        />
        <span className="text-sm text-slate-500">
          {filtered.length} / {allInteractions.length} events
        </span>
      </div>

      {/* Event list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Provider</th>
              <th className="px-4 py-3 text-left">File</th>
              <th className="px-4 py-3 text-left">Feature</th>
              <th className="px-4 py-3 text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <EventRow key={event.id} event={event} issues={feedback.get(event.id) ?? []} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventRow({ event, issues }: { event: InteractionData & { featureName: string; featureIcon: string }; issues: EventIssueData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState<CodeContextData | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!context) {
      setLoadingCtx(true);
      try {
        const data = await api.getCodeContext(
          event.file,
          event.line,
          event.suggestedEvent,
          event.suggestedProps ?? {},
          event.existingEvent,
          event.tracked
        );
        setContext(data);
      } catch {
        // ignore
      } finally {
        setLoadingCtx(false);
      }
    }
  }, [expanded, context, event]);

  return (
    <>
      <tr
        onClick={handleExpand}
        className={`border-b transition-all cursor-pointer group ${
          expanded
            ? "bg-slate-700/40 border-l-2 border-l-blue-500 border-b-slate-700/50"
            : "border-l-2 border-l-transparent border-b-slate-700/50 hover:bg-slate-700/20 hover:border-l-slate-500"
        }`}
      >
        <td className="px-4 py-3">
          {event.tracked ? (
            <span className="text-green-400">{"\u2705"}</span>
          ) : (
            <span className="text-red-400">{"\u274C"}</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-200">
              {event.tracked ? event.existingEvent : event.suggestedEvent}
            </span>
            {issues.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                issues.some((i) => i.severity === "error")
                  ? "bg-red-500/20 text-red-400"
                  : issues.some((i) => i.severity === "warning")
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-blue-500/20 text-blue-400"
              }`}>
                {issues.length} {issues.length === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-500">{event.description}</p>
            <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {expanded ? "Hide" : issues.length > 0 ? "View issues" : event.tracked ? "Details" : "View code preview"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <ProviderBadge provider={event.detectedProvider ?? "none"} />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-400">
          {event.file}
        </td>
        <td className="px-4 py-3 text-slate-400">
          <span>{event.featureIcon} {event.featureName}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-mono text-slate-500">{event.line}</span>
            <span className={`text-slate-500 transition-transform duration-200 text-xs ${expanded ? "rotate-90" : ""}`}>
              {"\u25B6"}
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-slate-800/50">
            {/* Event issues */}
            {issues.length > 0 && (
              <div className="mb-4 space-y-2">
                {issues.map((issue, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg border ${
                    issue.severity === "error" ? "border-red-500/20 bg-red-500/5" :
                    issue.severity === "warning" ? "border-yellow-500/20 bg-yellow-500/5" :
                    "border-blue-500/20 bg-blue-500/5"
                  }`}>
                    <span className="flex-shrink-0">{
                      issue.severity === "error" ? "\uD83D\uDD34" :
                      issue.severity === "warning" ? "\uD83D\uDFE1" : "\uD83D\uDD35"
                    }</span>
                    <div>
                      <p className="text-slate-200 font-medium">{issue.message}</p>
                      <p className="text-slate-400 mt-0.5">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {event.tracked ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-400">
                  Tracked with <span className="font-mono text-green-400">{event.existingEvent}</span> via <ProviderBadge provider={event.detectedProvider ?? "unknown"} />
                </div>
                {loadingCtx ? (
                  <div className="text-sm text-slate-500">Loading code context...</div>
                ) : context ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold">Current implementation</p>
                      <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                        {context.before.map((l, i) => (
                          <div key={`b${i}`} className="text-slate-500">{l}</div>
                        ))}
                        <div className="text-green-300 bg-green-500/10 -mx-3 px-3 border-l-2 border-green-500">{context.targetLine}</div>
                        {context.after.map((l, i) => (
                          <div key={`a${i}`} className="text-slate-500">{l}</div>
                        ))}
                      </pre>
                    </div>
                    {issues.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold">Suggested improvement</p>
                        <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                          {context.before.map((l, i) => (
                            <div key={`sb${i}`} className="text-slate-500">{l}</div>
                          ))}
                          <div className="text-red-300 bg-red-500/10 -mx-3 px-3 border-l-2 border-red-500 line-through opacity-60">{context.targetLine}</div>
                          <div className="text-green-300 bg-green-500/10 -mx-3 px-3 border-l-2 border-green-500">
                            {context.targetLine
                              .replace(event.existingEvent ?? "", event.suggestedEvent)
                            }
                          </div>
                          {context.after.map((l, i) => (
                            <div key={`sa${i}`} className="text-slate-500">{l}</div>
                          ))}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : loadingCtx ? (
              <div className="text-sm text-slate-500">Loading code context...</div>
            ) : context ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold">Current code</p>
                  <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    {context.before.map((l, i) => (
                      <div key={`b${i}`} className="text-slate-500">{l}</div>
                    ))}
                    <div className="text-red-300 bg-red-500/10 -mx-3 px-3">{context.targetLine}</div>
                    {context.after.map((l, i) => (
                      <div key={`a${i}`} className="text-slate-500">{l}</div>
                    ))}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 uppercase font-semibold">Preview with tracking</p>
                  <pre className="bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    {context.preview.map((l, i) => {
                      const isNew = l.includes(event.suggestedEvent);
                      return (
                        <div
                          key={`p${i}`}
                          className={
                            isNew
                              ? "text-green-300 bg-green-500/10 -mx-3 px-3 border-l-2 border-green-500"
                              : "text-slate-500"
                          }
                        >
                          {isNew ? `+ ${l}` : `  ${l}`}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No context available</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
