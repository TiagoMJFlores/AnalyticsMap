import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { Feature } from "@analyticsmap/shared";

const FEATURES_FILE = "features.yml";

function getFeaturesPath(projectRoot: string): string {
  return path.join(projectRoot, ".analyticsmap", FEATURES_FILE);
}

export function loadFeatures(projectRoot: string): Feature[] | null {
  const featuresPath = getFeaturesPath(projectRoot);

  if (!fs.existsSync(featuresPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(featuresPath, "utf-8");
    return yaml.load(raw) as Feature[];
  } catch {
    return null;
  }
}

export function saveFeatures(projectRoot: string, features: Feature[]): void {
  const featuresPath = getFeaturesPath(projectRoot);
  const dir = path.dirname(featuresPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const serializable = features.map((f) => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    files: f.files,
    analysisStatus: f.analysisStatus,
    trackedCount: f.trackedCount,
    missingCount: f.missingCount,
    coveragePercent: f.coveragePercent,
  }));

  fs.writeFileSync(
    featuresPath,
    yaml.dump(serializable, { lineWidth: 120, noRefs: true }),
    "utf-8"
  );
}

export function updateFeature(
  projectRoot: string,
  featureId: string,
  update: Partial<Feature>
): void {
  const features = loadFeatures(projectRoot);
  if (!features) return;

  const index = features.findIndex((f) => f.id === featureId || f.name === featureId);
  if (index === -1) return;

  features[index] = { ...features[index], ...update };
  saveFeatures(projectRoot, features);
}
