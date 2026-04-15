import type { Interaction } from "@analyticsmap/shared";

export type EventIssueSeverity = "error" | "warning" | "info";

export interface EventIssue {
  type: string;
  severity: EventIssueSeverity;
  message: string;
  suggestion: string;
}

export interface EventFeedback {
  interactionId: string;
  issues: EventIssue[];
}

// Best practice naming rules
const NAMING_RULES = [
  {
    type: "naming-too-short",
    test: (name: string) => name.length < 5,
    severity: "warning" as const,
    message: "Event name is too short",
    suggestion: "Use descriptive names like 'checkout_button_click' instead of short abbreviations",
  },
  {
    type: "naming-too-long",
    test: (name: string) => name.length > 50,
    severity: "info" as const,
    message: "Event name is very long",
    suggestion: "Keep event names under 50 characters for readability in analytics dashboards",
  },
  {
    type: "naming-no-structure",
    test: (name: string) => name.split("_").length < 2 && !/[A-Z]/.test(name.slice(1)),
    severity: "warning" as const,
    message: "Event name has no structure",
    suggestion: "Use a multi-part name like '{subject}_{action}' (e.g., 'cart_checkout') so events are groupable and searchable in dashboards",
  },
  {
    type: "naming-mixed-case",
    test: (name: string) => /[A-Z]/.test(name) && /_/.test(name),
    severity: "error" as const,
    message: "Mixed naming convention (camelCase + snake_case)",
    suggestion: "Pick one convention. snake_case is the analytics industry standard",
  },
  {
    type: "naming-camel-case",
    test: (name: string) => /^[a-z]+[A-Z]/.test(name),
    severity: "info" as const,
    message: "Using camelCase instead of snake_case",
    suggestion: "snake_case is the standard in most analytics platforms (Segment, Amplitude, Mixpanel)",
  },
  {
    type: "naming-starts-with-on",
    test: (name: string) => /^on[A-Z_]/.test(name),
    severity: "warning" as const,
    message: "Event name starts with 'on' (code handler pattern, not analytics)",
    suggestion: "Use the action itself: 'button_click' not 'onButtonClick'",
  },
  {
    type: "naming-generic",
    test: (name: string) => /^(click|event|action|track|button|item|element)$/.test(name),
    severity: "error" as const,
    message: "Event name is too generic",
    suggestion: "Be specific: 'checkout_purchase_click' tells you exactly what happened and where",
  },
];

// Property quality rules
const PROPERTY_RULES = [
  {
    type: "props-no-screen",
    test: (props: Record<string, string>) => !props.screen && !props.page && !props.view,
    severity: "info" as const,
    message: "Missing 'screen' or 'page' property",
    suggestion: "Always include which screen/page the event happened on for segmentation",
  },
  // Removed: "string"/"number" as prop values are valid type definitions in a tracking plan
];

// Duplicate detection across all events
function findDuplicateNames(interactions: Interaction[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const i of interactions) {
    const name = i.tracked ? (i.existingEvent ?? "") : i.suggestedEvent;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

export function checkEvents(interactions: Interaction[], files?: { relativePath: string; content: string }[]): EventFeedback[] {
  const duplicateCounts = findDuplicateNames(interactions);

  // Check if project has event constants defined
  const hasEventConstants = files?.some((f) =>
    /export\s+(?:const|enum)\s+(?:Events|EVENTS|AnalyticsEvents|TrackingEvents|EVENT_NAMES)/i.test(f.content) ||
    /export\s+const\s+[A-Z_]+\s*=\s*['"][a-z_]+['"]/i.test(f.content)
  ) ?? false;

  return interactions.map((interaction) => {
    const issues: EventIssue[] = [];
    const eventName = interaction.tracked
      ? (interaction.existingEvent ?? interaction.suggestedEvent)
      : interaction.suggestedEvent;

    // Naming rules
    for (const rule of NAMING_RULES) {
      if (rule.test(eventName)) {
        issues.push({
          type: rule.type,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }

    // Property rules (only for tracked events with props)
    const props = interaction.suggestedProps ?? {};
    for (const rule of PROPERTY_RULES) {
      if (rule.test(props)) {
        issues.push({
          type: rule.type,
          severity: rule.severity,
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }

    // Duplicate name check
    const count = duplicateCounts.get(eventName) ?? 0;
    if (count > 1) {
      issues.push({
        type: "duplicate-name",
        severity: "warning",
        message: `Event name "${eventName}" is used ${count} times`,
        suggestion: "Each event should have a unique name. Add context to distinguish them",
      });
    }

    // Hardcoded string check (only for tracked events)
    if (interaction.tracked && !hasEventConstants) {
      issues.push({
        type: "hardcoded-name",
        severity: "warning",
        message: "Event name is a hardcoded string",
        suggestion: "Define as a constant: export const Events = { " + eventName.toUpperCase() + ": '" + eventName + "' }",
      });
    }

    return {
      interactionId: interaction.id,
      issues,
    };
  });
}
