import type { ScannedFile } from "./fileScanner.js";
import type { DetectedProviderInfo } from "./providerDetector.js";

export type IssueSeverity = "error" | "warning" | "info";

export interface HealthIssue {
  id: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  files: string[];
  suggestion: string;
  codeExample?: string;
}

export interface HealthReport {
  score: number; // 0-100
  issues: HealthIssue[];
  passed: string[];
}

// Patterns that indicate a facade/wrapper exists
const FACADE_PATTERNS = [
  /export\s+(?:function|const)\s+track(?:Event|Analytics|)\s*[(<]/,
  /export\s+(?:function|const)\s+logEvent\s*[(<]/,
  /export\s+(?:function|const)\s+sendEvent\s*[(<]/,
  /export\s+(?:function|const)\s+captureEvent\s*[(<]/,
  /export\s+class\s+Analytics/,
  /export\s+const\s+analytics\s*=\s*\{/,
  /createAnalytics|analyticsService|AnalyticsProvider/,
];

// Patterns of direct SDK calls (not via wrapper)
const DIRECT_CALL_PATTERNS = [
  { pattern: /posthog\.capture\s*\(/g, provider: "posthog" },
  { pattern: /logEvent\s*\(\s*analytics/g, provider: "firebase" },
  { pattern: /firebase\.analytics\(\)\.logEvent\s*\(/g, provider: "firebase" },
  { pattern: /mixpanel\.track\s*\(/g, provider: "mixpanel" },
  { pattern: /amplitude\.track\s*\(/g, provider: "amplitude" },
  { pattern: /Sentry\.capture(?:Exception|Message|Event)\s*\(/g, provider: "sentry" },
  { pattern: /analytics\.track\s*\(/g, provider: "segment" },
  { pattern: /gtag\s*\(/g, provider: "google-analytics" },
  { pattern: /datadogRum\.addAction\s*\(/g, provider: "datadog" },
];

interface DirectCall {
  provider: string;
  file: string;
  count: number;
}

function findFacade(files: ScannedFile[]): ScannedFile | null {
  // Look for a dedicated analytics file first
  const analyticsFiles = files.filter((f) =>
    /(?:analytics|tracking|events)\.(ts|js|tsx|jsx)$/i.test(f.relativePath)
  );

  for (const file of analyticsFiles) {
    if (FACADE_PATTERNS.some((p) => p.test(file.content))) {
      return file;
    }
  }

  // Check all files
  for (const file of files) {
    if (FACADE_PATTERNS.some((p) => p.test(file.content))) {
      return file;
    }
  }

  return null;
}

function findDirectCalls(files: ScannedFile[]): DirectCall[] {
  const calls: DirectCall[] = [];

  for (const file of files) {
    for (const { pattern, provider } of DIRECT_CALL_PATTERNS) {
      const re = new RegExp(pattern.source, "g");
      const matches = file.content.match(re);
      if (matches && matches.length > 0) {
        calls.push({
          provider,
          file: file.relativePath,
          count: matches.length,
        });
      }
    }
  }

  return calls;
}

function findDuplicateEvents(files: ScannedFile[]): Map<string, string[]> {
  // Find event names used across multiple providers
  const eventProviders = new Map<string, Set<string>>();

  for (const file of files) {
    // Match patterns like track('event_name'), capture('event_name'), logEvent(analytics, 'event_name')
    const eventMatches = file.content.matchAll(
      /(?:track|capture|logEvent)\s*\(\s*(?:analytics\s*,\s*)?['"]([a-z_]+)['"]/g
    );

    for (const match of eventMatches) {
      const eventName = match[1];
      const line = file.content.substring(0, match.index).split("\n").length;
      const lineContent = file.content.split("\n")[line - 1] ?? "";

      // Determine provider from the line
      let provider = "unknown";
      if (/posthog/.test(lineContent)) provider = "posthog";
      else if (/logEvent|firebase/.test(lineContent)) provider = "firebase";
      else if (/mixpanel/.test(lineContent)) provider = "mixpanel";
      else if (/amplitude/.test(lineContent)) provider = "amplitude";
      else if (/Sentry/.test(lineContent)) provider = "sentry";
      else if (/gtag/.test(lineContent)) provider = "google-analytics";

      const existing = eventProviders.get(eventName) ?? new Set();
      existing.add(provider);
      eventProviders.set(eventName, existing);
    }
  }

  // Filter to events with 2+ providers
  const duplicates = new Map<string, string[]>();
  for (const [event, providerSet] of eventProviders) {
    if (providerSet.size >= 2) {
      duplicates.set(event, Array.from(providerSet));
    }
  }

  return duplicates;
}

function checkNamingConsistency(files: ScannedFile[]): { consistent: boolean; patterns: string[]; examples: string[] } {
  const eventNames: string[] = [];

  for (const file of files) {
    const matches = file.content.matchAll(
      /(?:track|capture|logEvent)\s*\(\s*(?:analytics\s*,\s*)?['"]([a-z][a-z0-9_]+)['"]/g
    );
    for (const match of matches) {
      eventNames.push(match[1]);
    }
  }

  if (eventNames.length === 0) return { consistent: true, patterns: [], examples: [] };

  // Detect patterns
  const snakeCase = eventNames.filter((n) => /^[a-z]+(_[a-z]+)+$/.test(n));
  const camelCase = eventNames.filter((n) => /^[a-z]+[A-Z]/.test(n));
  const noSeparator = eventNames.filter((n) => /^[a-z]+$/.test(n));

  const patterns: string[] = [];
  if (snakeCase.length > 0) patterns.push(`snake_case (${snakeCase.length})`);
  if (camelCase.length > 0) patterns.push(`camelCase (${camelCase.length})`);
  if (noSeparator.length > 0) patterns.push(`noseparator (${noSeparator.length})`);

  const inconsistentExamples: string[] = [];
  if (patterns.length > 1) {
    if (snakeCase.length > 0) inconsistentExamples.push(snakeCase[0]);
    if (camelCase.length > 0) inconsistentExamples.push(camelCase[0]);
  }

  return {
    consistent: patterns.length <= 1,
    patterns,
    examples: inconsistentExamples,
  };
}

export function checkAnalyticsHealth(
  files: ScannedFile[],
  providers: DetectedProviderInfo[]
): HealthReport {
  const issues: HealthIssue[] = [];
  const passed: string[] = [];
  let score = 100;

  const activeProviders = providers.filter((p) => p.detected);
  const facade = findFacade(files);
  const directCalls = findDirectCalls(files);
  const duplicateEvents = findDuplicateEvents(files);
  const naming = checkNamingConsistency(files);

  // Check 1: No analytics facade
  if (!facade && activeProviders.length > 0) {
    const totalDirectCalls = directCalls.reduce((s, c) => s + c.count, 0);
    const directFiles = [...new Set(directCalls.map((c) => c.file))];

    issues.push({
      id: "no-facade",
      severity: "error",
      title: "No analytics facade detected",
      description: `${totalDirectCalls} direct tracking calls across ${directFiles.length} files. ${activeProviders.length} providers called separately without a wrapper.`,
      files: directFiles.slice(0, 5),
      suggestion: "Create a unified trackEvent() function that wraps all providers. This centralizes tracking, makes it easy to add/remove providers, and ensures consistency.",
      codeExample: `// analytics.ts
export function trackEvent(name: string, props?: Record<string, unknown>) {
${activeProviders.map((p) => {
  if (p.provider === "posthog") return "  posthog.capture(name, props);";
  if (p.provider === "firebase") return "  logEvent(analytics, name, props);";
  if (p.provider === "mixpanel") return "  mixpanel.track(name, props);";
  if (p.provider === "amplitude") return "  amplitude.track(name, props);";
  if (p.provider === "sentry") return "  Sentry.addBreadcrumb({ message: name, data: props });";
  return `  // ${p.provider}: add tracking here`;
}).join("\n")}
}`,
    });
    score -= 30;
  } else if (facade) {
    passed.push("Analytics facade found: " + facade.relativePath);
  }

  // (merged into "no-facade" check above)

  // Check 3: Duplicate events across providers
  if (duplicateEvents.size > 0) {
    const examples = Array.from(duplicateEvents.entries()).slice(0, 3);
    issues.push({
      id: "duplicate-events",
      severity: "warning",
      title: `${duplicateEvents.size} events duplicated across providers`,
      description: examples
        .map(([event, provs]) => `"${event}" tracked in ${provs.join(" + ")}`)
        .join(". "),
      files: [],
      suggestion: "These events are tracked multiple times in different providers. A facade would call all providers in one place.",
    });
    score -= 10;
  } else if (activeProviders.length >= 2) {
    passed.push("No duplicate event names across providers");
  }

  // Check 4: Naming inconsistency
  if (!naming.consistent) {
    issues.push({
      id: "naming-inconsistent",
      severity: "warning",
      title: "Inconsistent event naming",
      description: `Mixed naming patterns: ${naming.patterns.join(", ")}. Examples: ${naming.examples.map((e) => `"${e}"`).join(", ")}.`,
      files: [],
      suggestion: "Pick one convention (e.g., snake_case) and use it everywhere. Configure in .analyticsmap/config.yml.",
    });
    score -= 10;
  } else if (naming.patterns.length > 0) {
    passed.push(`Consistent naming: ${naming.patterns[0]}`);
  }

  // Check 5: Tracking in catch blocks (error-only tracking without success tracking)
  const filesWithOnlyErrorTracking: string[] = [];
  for (const file of files) {
    const hasCatchTracking = /catch\s*[\s\S]{0,100}(?:capture|track|logEvent)/g.test(file.content);
    const hasSuccessTracking = /(?:capture|track|logEvent)\s*\(\s*(?:analytics\s*,\s*)?['"][^'"]*(?:success|complete|done)['"]/g.test(file.content);
    if (hasCatchTracking && !hasSuccessTracking) {
      filesWithOnlyErrorTracking.push(file.relativePath);
    }
  }

  if (filesWithOnlyErrorTracking.length > 0) {
    issues.push({
      id: "error-only-tracking",
      severity: "info",
      title: "Error tracking without success tracking",
      description: `${filesWithOnlyErrorTracking.length} files track errors but not successful outcomes.`,
      files: filesWithOnlyErrorTracking.slice(0, 3),
      suggestion: "Track both success and error paths to measure conversion rates (e.g., 'payment_success' + 'payment_error').",
    });
    score -= 5;
  }

  return {
    score: Math.max(0, score),
    issues: issues.sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    passed,
  };
}
