// ── Platform detection ──

export type Platform =
  | "react-native"
  | "swift"
  | "kotlin"
  | "flutter"
  | "react-web"
  | "auto";

export type AnalyticsProvider =
  | "segment"
  | "posthog"
  | "amplitude"
  | "mixpanel"
  | "firebase"
  | "custom"
  | "auto";

// ── Project metadata ──

export interface ProjectInfo {
  name: string;
  root: string;
  platform: Platform;
  totalFiles: number;
  totalInteractions: number;
  trackedInteractions: number;
  coveragePercent: number;
  lastScanAt: string;
}

// ── Analytics Providers (detected in code) ──

export type DetectedProvider =
  | "firebase"
  | "sentry"
  | "posthog"
  | "mixpanel"
  | "amplitude"
  | "segment"
  | "google-analytics"
  | "datadog"
  | "custom"
  | "unknown"
  | "none";

// ── Interactions ──

export interface Interaction {
  id: string;
  file: string;
  line: number;
  element: string;
  description: string;
  suggestedEvent: string;
  suggestedProps: Record<string, string>;
  tracked: boolean;
  existingEvent?: string;
  detectedProvider?: DetectedProvider;
}

// ── Provider Summary ──

export interface ProviderSummary {
  provider: DetectedProvider;
  eventCount: number;
  files: string[];
}

// ── Features ──

export type FeatureAnalysisStatus = "pending" | "analyzing" | "done" | "error";

export interface Feature {
  id: string;
  name: string;
  icon: string;
  files: string[];
  analysisStatus: FeatureAnalysisStatus;
  interactions: Interaction[];
  trackedCount: number;
  missingCount: number;
  coveragePercent: number;
}

// ── Tracking Plan ──

export interface PlanEvent {
  name: string;
  file: string;
  line: number;
  element: string;
  description: string;
  properties: Record<string, string>;
  feature: string;
  status: "active" | "missing" | "stale";
  addedAt: string;
}

export interface TrackingPlan {
  version: string;
  lastScanAt: string;
  platform: Platform;
  events: PlanEvent[];
}

// ── Rules ──

export type RuleSeverity = "error" | "warning";
export type RuleStatus = "pass" | "fail";

export interface TrackingRule {
  id: string;
  name: string;
  description: string;
  scope: string;
  element?: string;
  minCoverage?: number;
  severity: RuleSeverity;
}

export interface RuleResult {
  rule: TrackingRule;
  status: RuleStatus;
  passCount: number;
  failCount: number;
  details: string[];
}

export interface ValidationResult {
  totalRules: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  results: RuleResult[];
}

// ── RAG / Chat ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
  sources?: string[];
  timestamp: string;
}

export type ChatActionType =
  | "add-tracking"
  | "create-rule"
  | "navigate"
  | "remove-stale";

export interface ChatAction {
  type: ChatActionType;
  label: string;
  target: string;
  payload?: Record<string, unknown>;
}

export interface ChatRequest {
  question: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatResponse {
  answer: string;
  actions: ChatAction[];
  sources: string[];
}

// ── Config ──

export interface AnalyticsMapConfig {
  platform: Platform;
  naming: string;
  requiredProperties: string[];
  ignore: string[];
  trackingFunction: string;
  provider: AnalyticsProvider;
}

export const DEFAULT_CONFIG: AnalyticsMapConfig = {
  platform: "auto",
  naming: "{screen}_{element}_{action}",
  requiredProperties: ["screen", "element_type"],
  ignore: [
    "**/*.test.*",
    "**/__tests__/**",
    "**/node_modules/**",
    "**/Pods/**",
    "**/build/**",
    "**/.gradle/**",
    "**/DerivedData/**",
  ],
  trackingFunction: "analytics.track",
  provider: "auto",
};
