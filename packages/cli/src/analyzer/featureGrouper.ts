import Anthropic from "@anthropic-ai/sdk";
import type { Feature, Interaction } from "@analyticsmap/shared";
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

export async function groupByFeature(
  files: ScannedFile[],
  interactions: Interaction[]
): Promise<Feature[]> {
  const anthropic = getClient();

  const fileList = files.map((f) => f.relativePath).join("\n");

  const prompt = `You are analyzing a mobile app project structure to group files by business feature.

Here are all the files in the project:
${fileList}

Group these files into logical business features (e.g., "Auth", "Cart", "Profile", "Settings", "Onboarding", "Chat").

For each feature, provide:
- "name": feature name (short, PascalCase)
- "icon": a single emoji that represents this feature
- "files": array of file paths belonging to this feature

Rules:
- Every file should belong to exactly one feature
- Group by business domain, not by technical layer
- If unsure, create a "Common" or "Shared" feature for utility files
- Aim for 4-10 features total

Return ONLY a JSON array.

JSON array:`;

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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new LLMError("No JSON array in feature grouping response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      name: string;
      icon: string;
      files: string[];
    }>;

    return parsed.map((group) => {
      // If interactions were provided, compute coverage
      const featureInteractions = interactions.filter((i) =>
        group.files.includes(i.file)
      );
      const hasInteractions = featureInteractions.length > 0;
      const trackedCount = featureInteractions.filter((i) => i.tracked).length;
      const missingCount = featureInteractions.filter((i) => !i.tracked).length;
      const total = trackedCount + missingCount;

      return {
        id: nanoid(10),
        name: group.name,
        icon: group.icon,
        files: group.files,
        analysisStatus: hasInteractions ? "done" as const : "pending" as const,
        interactions: featureInteractions,
        trackedCount,
        missingCount,
        coveragePercent: total > 0 ? Math.round((trackedCount / total) * 100) : 0,
      };
    });
  } catch (err) {
    if (err instanceof LLMError) throw err;
    throw new LLMError(
      `Feature grouping failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
