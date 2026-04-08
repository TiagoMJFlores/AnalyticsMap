import type { Interaction, Feature, ProjectInfo, Platform } from "@analyticsmap/shared";

export function calculateProjectCoverage(
  projectName: string,
  projectRoot: string,
  platform: Platform,
  totalFiles: number,
  interactions: Interaction[]
): ProjectInfo {
  const tracked = interactions.filter((i) => i.tracked).length;
  const total = interactions.length;

  return {
    name: projectName,
    root: projectRoot,
    platform,
    totalFiles,
    totalInteractions: total,
    trackedInteractions: tracked,
    coveragePercent: total > 0 ? Math.round((tracked / total) * 100) : 100,
    lastScanAt: new Date().toISOString(),
  };
}

export function calculateFeatureCoverage(
  features: Feature[]
): { overall: number; perFeature: Array<{ name: string; coverage: number }> } {
  let totalTracked = 0;
  let totalInteractions = 0;

  const perFeature = features.map((f) => {
    totalTracked += f.trackedCount;
    totalInteractions += f.trackedCount + f.missingCount;
    return {
      name: f.name,
      coverage: f.coveragePercent,
    };
  });

  return {
    overall:
      totalInteractions > 0
        ? Math.round((totalTracked / totalInteractions) * 100)
        : 100,
    perFeature,
  };
}

export function getFileCoverage(
  interactions: Interaction[]
): Map<string, { tracked: number; missing: number; coverage: number }> {
  const fileMap = new Map<string, { tracked: number; missing: number }>();

  for (const interaction of interactions) {
    const entry = fileMap.get(interaction.file) ?? { tracked: 0, missing: 0 };
    if (interaction.tracked) {
      entry.tracked++;
    } else {
      entry.missing++;
    }
    fileMap.set(interaction.file, entry);
  }

  const result = new Map<
    string,
    { tracked: number; missing: number; coverage: number }
  >();

  for (const [file, counts] of fileMap) {
    const total = counts.tracked + counts.missing;
    result.set(file, {
      ...counts,
      coverage: total > 0 ? Math.round((counts.tracked / total) * 100) : 100,
    });
  }

  return result;
}
