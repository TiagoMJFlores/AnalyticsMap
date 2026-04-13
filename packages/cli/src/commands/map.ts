import ora from "ora";
import * as path from "node:path";
import * as fs from "node:fs";
import yaml from "js-yaml";
import { loadConfig } from "../config.js";
import { scanFiles, detectPlatform } from "../analyzer/fileScanner.js";
import { groupByFeature } from "../analyzer/featureGrouper.js";
import { log } from "../lib/logger.js";
import { saveFeatures, loadFeatures } from "../plan/featuresStore.js";

interface MapOptions {
  path: string;
  init?: boolean;
}

export async function mapCommand(options: MapOptions): Promise<void> {
  const projectRoot = path.resolve(options.path);

  log.heading("AnalyticsMap — Detect Features");
  log.dim(`Project: ${projectRoot}`);

  if (options.init) {
    const { initConfig } = await import("../config.js");
    const configPath = initConfig(projectRoot);
    log.success(`Config initialized at ${configPath}`);
  }

  const config = loadConfig(projectRoot);

  const fileSpinner = ora("Scanning files...").start();
  const files = await scanFiles(projectRoot, config);
  fileSpinner.succeed(`Found ${files.length} files`);

  if (files.length === 0) {
    log.warn("No files found. Check your .analyticsmap/config.yml");
    return;
  }

  const platform =
    config.platform === "auto" ? detectPlatform(files) : config.platform;
  log.dim(`Platform: ${platform}`);

  const groupSpinner = ora("Detecting features with AI...").start();
  const features = await groupByFeature(files, []);
  groupSpinner.succeed(`Detected ${features.length} features`);

  saveFeatures(projectRoot, features);

  console.log("");
  log.heading("Features");
  for (const feature of features) {
    console.log(
      `\n  ${feature.icon} ${feature.name}  (${feature.files.length} files)`
    );
    for (const file of feature.files.slice(0, 5)) {
      log.dim(`    └── ${file}`);
    }
    if (feature.files.length > 5) {
      log.dim(`    └── ... +${feature.files.length - 5} more`);
    }
  }

  console.log("");
  log.success(`Features saved to .analyticsmap/features.yml`);
  console.log("");
  log.dim(
    `Next: run 'analyticsmap scan --feature "${features[0]?.name}"' to check coverage`
  );
  log.dim(`  or: run 'analyticsmap ui' to analyze interactively`);
}
