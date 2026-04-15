import type { DetectedProvider } from "@analyticsmap/shared";
import type { ScannedFile } from "./fileScanner.js";

interface ProviderPattern {
  provider: DetectedProvider;
  label: string;
  icon: string;
  importPatterns: RegExp[];
  usagePatterns: RegExp[];
  sdkPackage: string;
}

const PROVIDER_PATTERNS: ProviderPattern[] = [
  {
    provider: "firebase",
    label: "Firebase Analytics",
    icon: "\uD83D\uDD25",
    importPatterns: [
      /from\s+['"]firebase\/analytics['"]/,
      /from\s+['"]@react-native-firebase\/analytics['"]/,
      /require\(['"]firebase\/analytics['"]\)/,
    ],
    usagePatterns: [
      /logEvent\s*\(/,
      /analytics\(\)\.logEvent\s*\(/,
      /firebase\.analytics\s*\(/,
    ],
    sdkPackage: "firebase",
  },
  {
    provider: "sentry",
    label: "Sentry",
    icon: "\uD83D\uDC1B",
    importPatterns: [
      /from\s+['"]@sentry\//,
      /require\(['"]@sentry\//,
    ],
    usagePatterns: [
      /Sentry\.captureException\s*\(/,
      /Sentry\.captureMessage\s*\(/,
      /Sentry\.captureEvent\s*\(/,
      /Sentry\.init\s*\(/,
    ],
    sdkPackage: "@sentry/browser",
  },
  {
    provider: "posthog",
    label: "PostHog",
    icon: "\uD83E\uDDA4",
    importPatterns: [
      /from\s+['"]posthog-js['"]/,
      /from\s+['"]posthog-react-native['"]/,
      /require\(['"]posthog-js['"]\)/,
    ],
    usagePatterns: [
      /posthog\.capture\s*\(/,
      /posthog\.identify\s*\(/,
      /usePostHog\s*\(/,
      /PostHogProvider/,
    ],
    sdkPackage: "posthog-js",
  },
  {
    provider: "mixpanel",
    label: "Mixpanel",
    icon: "\uD83C\uDFB2",
    importPatterns: [
      /from\s+['"]mixpanel-browser['"]/,
      /from\s+['"]mixpanel-react-native['"]/,
      /require\(['"]mixpanel/,
    ],
    usagePatterns: [
      /mixpanel\.track\s*\(/,
      /mixpanel\.identify\s*\(/,
      /Mixpanel\.track\s*\(/,
    ],
    sdkPackage: "mixpanel-browser",
  },
  {
    provider: "amplitude",
    label: "Amplitude",
    icon: "\uD83D\uDCC8",
    importPatterns: [
      /from\s+['"]@amplitude\/analytics/,
      /from\s+['"]amplitude-js['"]/,
      /require\(['"]@amplitude/,
    ],
    usagePatterns: [
      /amplitude\.track\s*\(/,
      /amplitude\.logEvent\s*\(/,
      /Amplitude\.getInstance\s*\(/,
    ],
    sdkPackage: "@amplitude/analytics-browser",
  },
  {
    provider: "segment",
    label: "Segment",
    icon: "\uD83D\uDD17",
    importPatterns: [
      /from\s+['"]@segment\//,
      /from\s+['"]analytics-node['"]/,
      /require\(['"]@segment/,
    ],
    usagePatterns: [
      /analytics\.track\s*\(/,
      /analytics\.identify\s*\(/,
      /analytics\.page\s*\(/,
    ],
    sdkPackage: "@segment/analytics-node",
  },
  {
    provider: "google-analytics",
    label: "Google Analytics",
    icon: "\uD83D\uDCCA",
    importPatterns: [
      /from\s+['"]react-ga['"]/,
      /from\s+['"]react-ga4['"]/,
    ],
    usagePatterns: [
      /gtag\s*\(/,
      /\bga\s*\(\s*['"]send['"]/,
      /ReactGA\.event\s*\(/,
      /ReactGA\.send\s*\(/,
    ],
    sdkPackage: "react-ga4",
  },
  {
    provider: "datadog",
    label: "Datadog",
    icon: "\uD83D\uDC36",
    importPatterns: [
      /from\s+['"]@datadog\//,
      /require\(['"]@datadog/,
    ],
    usagePatterns: [
      /datadogRum\.addAction\s*\(/,
      /datadogRum\.addError\s*\(/,
      /datadogLogs\.logger/,
    ],
    sdkPackage: "@datadog/browser-rum",
  },
];

export interface DetectedProviderInfo {
  provider: DetectedProvider;
  label: string;
  icon: string;
  sdkPackage: string;
  detected: boolean;
  importFound: boolean;
  usageCount: number;
  files: string[];
}

export function detectProviders(files: ScannedFile[]): DetectedProviderInfo[] {
  return PROVIDER_PATTERNS.map((pattern) => {
    let importFound = false;
    let usageCount = 0;
    const matchedFiles = new Set<string>();

    for (const file of files) {
      const hasImport = pattern.importPatterns.some((re) => re.test(file.content));
      if (hasImport) {
        importFound = true;
        matchedFiles.add(file.relativePath);
      }

      for (const re of pattern.usagePatterns) {
        const matches = file.content.match(new RegExp(re.source, "g"));
        if (matches) {
          usageCount += matches.length;
          matchedFiles.add(file.relativePath);
        }
      }
    }

    return {
      provider: pattern.provider,
      label: pattern.label,
      icon: pattern.icon,
      sdkPackage: pattern.sdkPackage,
      detected: importFound || usageCount > 0,
      importFound,
      usageCount,
      files: Array.from(matchedFiles),
    };
  });
}
