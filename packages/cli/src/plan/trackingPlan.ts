import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { TrackingPlan, PlanEvent, Interaction, Platform } from "@analyticsmap/shared";

const PLAN_FILE = "plan.yml";

function getPlanPath(projectRoot: string): string {
  return path.join(projectRoot, ".analyticsmap", PLAN_FILE);
}

export function loadPlan(projectRoot: string): TrackingPlan | null {
  const planPath = getPlanPath(projectRoot);

  if (!fs.existsSync(planPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(planPath, "utf-8");
    return yaml.load(raw) as TrackingPlan;
  } catch {
    return null;
  }
}

export function savePlan(projectRoot: string, plan: TrackingPlan): void {
  const planPath = getPlanPath(projectRoot);
  const dir = path.dirname(planPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = yaml.dump(plan, {
    lineWidth: 120,
    quotingType: '"',
    noRefs: true,
  });

  fs.writeFileSync(planPath, content, "utf-8");
}

export function buildPlanFromInteractions(
  interactions: Interaction[],
  platform: Platform,
  existingPlan: TrackingPlan | null
): TrackingPlan {
  const now = new Date().toISOString();
  const existingEvents = new Map(
    existingPlan?.events.map((e) => [`${e.file}:${e.line}`, e]) ?? []
  );

  const events: PlanEvent[] = interactions.map((interaction) => {
    const key = `${interaction.file}:${interaction.line}`;
    const existing = existingEvents.get(key);

    return {
      name: interaction.existingEvent ?? interaction.suggestedEvent,
      file: interaction.file,
      line: interaction.line,
      element: interaction.element,
      description: interaction.description,
      properties: interaction.suggestedProps,
      feature: "",  // filled in by feature grouper
      status: interaction.tracked ? "active" : "missing",
      addedAt: existing?.addedAt ?? now,
    };
  });

  // Detect stale events (were in old plan but not found in new scan)
  if (existingPlan) {
    for (const oldEvent of existingPlan.events) {
      const stillExists = events.some(
        (e) => e.file === oldEvent.file && e.line === oldEvent.line
      );
      if (!stillExists && oldEvent.status === "active") {
        events.push({ ...oldEvent, status: "stale" });
      }
    }
  }

  return {
    version: "1.0",
    lastScanAt: now,
    platform,
    events,
  };
}
