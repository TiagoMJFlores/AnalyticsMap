import ora from "ora";
import chalk from "chalk";
import * as path from "node:path";
import { loadConfig } from "../config.js";
import { scanFiles, detectPlatform } from "../analyzer/fileScanner.js";
import { analyzeFiles } from "../analyzer/llmAnalyzer.js";
import {
  calculateProjectCoverage,
  getFileCoverage,
} from "../analyzer/coverageCalc.js";
import {
  loadPlan,
  savePlan,
  buildPlanFromInteractions,
} from "../plan/trackingPlan.js";
import { loadFeatures, updateFeature } from "../plan/featuresStore.js";
import { log } from "../lib/logger.js";
import type { Feature } from "@analyticsmap/shared";

interface ScanOptions {
  path: string;
  feature?: string;
  all?: boolean;
  init?: boolean;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const projectRoot = path.resolve(options.path);

  log.heading("AnalyticsMap Scan");

  const config = loadConfig(projectRoot);
  const features = loadFeatures(projectRoot);

  if (!features) {
    log.error("No features detected yet. Run 'analyticsmap map' first.");
    return;
  }

  // Determine which features to scan
  let targetFeatures: Feature[];

  if (options.feature) {
    const found = features.find(
      (f) => f.name.toLowerCase() === options.feature!.toLowerCase()
    );
    if (!found) {
      log.error(`Feature "${options.feature}" not found.`);
      log.dim(`Available: ${features.map((f) => f.name).join(", ")}`);
      return;
    }
    targetFeatures = [found];
  } else if (options.all) {
    targetFeatures = features;
  } else {
    // Show features and ask which to scan
    log.heading("Features");
    for (const f of features) {
      const status =
        f.analysisStatus === "done"
          ? chalk.green(`✓ ${f.coveragePercent}%`)
          : chalk.dim("not analyzed");
      console.log(`  ${f.icon} ${f.name} (${f.files.length} files) ${status}`);
    }
    console.log("");
    log.dim(
      `Run 'analyticsmap scan --feature "FeatureName"' to analyze one`
    );
    log.dim(`Run 'analyticsmap scan --all' to analyze everything`);
    return;
  }

  // Scan all project files (to get contents for target feature files)
  const allFiles = await scanFiles(projectRoot, config);
  const platform =
    config.platform === "auto" ? detectPlatform(allFiles) : config.platform;

  for (const feature of targetFeatures) {
    console.log("");
    log.heading(`${feature.icon} ${feature.name}`);

    // Filter to only this feature's files
    const featureFiles = allFiles.filter((f) =>
      feature.files.includes(f.relativePath)
    );

    if (featureFiles.length === 0) {
      log.warn("No matching files found for this feature");
      continue;
    }

    log.dim(`${featureFiles.length} files to analyze`);

    // Analyze with LLM
    const spinner = ora("Analyzing interactions with AI...").start();

    try {
      const interactions = await analyzeFiles(
        featureFiles,
        config,
        platform,
        (done, total, file) => {
          spinner.text = `Analyzing ${done}/${total}: ${file}`;
        }
      );

      const tracked = interactions.filter((i) => i.tracked).length;
      const missing = interactions.filter((i) => !i.tracked).length;
      const total = tracked + missing;
      const coverage = total > 0 ? Math.round((tracked / total) * 100) : 100;

      spinner.succeed(
        `Found ${total} interactions (${tracked} tracked, ${missing} missing)`
      );

      // Update feature in store
      updateFeature(projectRoot, feature.id, {
        analysisStatus: "done",
        interactions,
        trackedCount: tracked,
        missingCount: missing,
        coveragePercent: coverage,
      });

      // Update tracking plan
      const existingPlan = loadPlan(projectRoot);
      const plan = buildPlanFromInteractions(interactions, platform, existingPlan);
      savePlan(projectRoot, plan);

      // Display coverage
      log.coverage(coverage, `${tracked}/${total} interactions tracked`);

      // Show missing tracking
      const fileCoverage = getFileCoverage(interactions);
      const filesWithMissing = Array.from(fileCoverage.entries())
        .filter(([, c]) => c.missing > 0)
        .sort((a, b) => b[1].missing - a[1].missing);

      if (filesWithMissing.length > 0) {
        console.log("");
        for (const [file, counts] of filesWithMissing) {
          console.log(
            `  ${chalk.red("❌")} ${file} — ${chalk.red(`${counts.missing} missing`)}`
          );
          const fileInteractions = interactions.filter(
            (i) => i.file === file && !i.tracked
          );
          for (const interaction of fileInteractions) {
            log.dim(
              `     line ${interaction.line}: ${interaction.description} → ${chalk.cyan(interaction.suggestedEvent)}`
            );
          }
        }
      }
    } catch (err) {
      spinner.fail(
        `Analysis failed: ${err instanceof Error ? err.message : String(err)}`
      );
      updateFeature(projectRoot, feature.id, { analysisStatus: "error" });
    }
  }

  console.log("");
  log.dim("Run 'analyticsmap ui' to see the visual dashboard");
}
