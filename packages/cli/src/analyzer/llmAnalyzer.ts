import Anthropic from "@anthropic-ai/sdk";
import type { Interaction, AnalyticsMapConfig, Platform } from "@analyticsmap/shared";
import { nanoid } from "nanoid";
import { LLMError } from "../lib/errors.js";
import { requireEnv } from "../lib/env.js";
import type { ScannedFile } from "./fileScanner.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = requireEnv("ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}

function buildPrompt(file: ScannedFile, config: AnalyticsMapConfig, platform: Platform): string {
  return `You are an expert mobile developer analyzing code for user-facing interactions that should have analytics tracking.

Platform: ${platform}
File: ${file.relativePath}
Naming convention: ${config.naming}
Tracking function: ${config.trackingFunction}

Analyze this code and find ALL user-facing interactions (buttons, taps, form submissions, navigation, toggles, gestures, modals, etc.).

For each interaction found, return:
- "line": the line number where the interaction occurs
- "element": the type of element (e.g., "button", "form", "navigation", "toggle", "gesture", "modal", "list")
- "description": a short human-readable description (e.g., "checkout purchase button")
- "suggestedEvent": event name following the naming convention "${config.naming}"
- "suggestedProps": key-value pairs of properties to track (e.g., {"screen": "string", "item_id": "string"})
- "tracked": true if there is already a call to "${config.trackingFunction}" or similar tracking nearby, false otherwise
- "existingEvent": if tracked is true, the event name used

Also detect if tracking/analytics calls already exist in the file. Look for these providers:
- Firebase: analytics().logEvent(), logEvent(analytics, ...), firebase.analytics()
- Sentry: Sentry.captureException(), Sentry.captureMessage(), Sentry.captureEvent()
- PostHog: posthog.capture(), usePostHog()
- Mixpanel: mixpanel.track(), Mixpanel.track()
- Amplitude: amplitude.track(), amplitude.logEvent()
- Segment: analytics.track(), analytics.identify()
- Google Analytics: gtag(), ga(), ReactGA.event()
- Datadog: datadogRum.addAction(), datadogLogs.logger

For each interaction, also return:
- "detectedProvider": which analytics provider is used (e.g., "firebase", "sentry", "posthog", "mixpanel", "amplitude", "segment", "google-analytics", "datadog", "custom", "unknown"). Use "none" if no tracking exists.

Return ONLY a JSON array. If no interactions found, return [].

\`\`\`
${file.content}
\`\`\`

JSON array:`;
}

export async function analyzeFile(
  file: ScannedFile,
  config: AnalyticsMapConfig,
  platform: Platform
): Promise<Interaction[]> {
  const anthropic = getClient();
  const prompt = buildPrompt(file, config, platform);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      line: number;
      element: string;
      description: string;
      suggestedEvent: string;
      suggestedProps: Record<string, string>;
      tracked: boolean;
      existingEvent?: string;
      detectedProvider?: string;
    }>;

    return parsed.map((item) => ({
      id: nanoid(10),
      file: file.relativePath,
      line: item.line,
      element: item.element,
      description: item.description,
      suggestedEvent: item.suggestedEvent,
      suggestedProps: item.suggestedProps ?? {},
      tracked: item.tracked ?? false,
      existingEvent: item.existingEvent,
      detectedProvider: (item.detectedProvider as Interaction["detectedProvider"]) ?? "none",
    }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new LLMError(
        `Failed to parse LLM response for ${file.relativePath}: invalid JSON`
      );
    }
    throw new LLMError(
      `LLM analysis failed for ${file.relativePath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function analyzeFiles(
  files: ScannedFile[],
  config: AnalyticsMapConfig,
  platform: Platform,
  onProgress?: (done: number, total: number, file: string) => void
): Promise<Interaction[]> {
  const allInteractions: Interaction[] = [];
  const BATCH_SIZE = 3; // parallel requests

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((file) => analyzeFile(file, config, platform))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        allInteractions.push(...result.value);
      }
      onProgress?.(i + j + 1, files.length, batch[j].relativePath);
    }
  }

  return allInteractions;
}
