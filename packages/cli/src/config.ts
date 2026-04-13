import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import type { AnalyticsMapConfig } from "@analyticsmap/shared";
import { DEFAULT_CONFIG } from "@analyticsmap/shared";
import { ConfigError } from "./lib/errors.js";

const CONFIG_DIR = ".analyticsmap";
const CONFIG_FILE = "config.yml";

export function getConfigDir(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_DIR);
}

export function getConfigPath(projectRoot: string): string {
  return path.join(projectRoot, CONFIG_DIR, CONFIG_FILE);
}

export function loadConfig(projectRoot: string): AnalyticsMapConfig {
  const configPath = getConfigPath(projectRoot);

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = yaml.load(raw) as Partial<AnalyticsMapConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    throw new ConfigError(
      `Failed to parse ${configPath}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function initConfig(projectRoot: string): string {
  const configDir = getConfigDir(projectRoot);
  const configPath = getConfigPath(projectRoot);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    const content = yaml.dump(DEFAULT_CONFIG, {
      lineWidth: 120,
      quotingType: '"',
    });
    fs.writeFileSync(configPath, content, "utf-8");
  }

  return configPath;
}
