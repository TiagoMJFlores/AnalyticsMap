import * as path from "node:path";
import * as fs from "node:fs";
import yaml from "js-yaml";
import chalk from "chalk";
import type {
  TrackingRule,
  RuleResult,
  ValidationResult,
  PlanEvent,
} from "@analyticsmap/shared";
import { loadPlan } from "../plan/trackingPlan.js";
import { log } from "../lib/logger.js";

interface ValidateOptions {
  path: string;
  ci?: boolean;
}

function loadRules(projectRoot: string): TrackingRule[] {
  const rulesPath = path.join(projectRoot, ".analyticsmap", "rules.yml");
  if (!fs.existsSync(rulesPath)) return [];

  try {
    const raw = fs.readFileSync(rulesPath, "utf-8");
    return (yaml.load(raw) as TrackingRule[]) ?? [];
  } catch {
    return [];
  }
}

function matchesScope(file: string, scope: string): boolean {
  if (!scope || scope === "*") return true;
  // Simple glob: "src/pages/Checkout/**" matches "src/pages/Checkout/Form.tsx"
  const pattern = scope.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
  return new RegExp(`^${pattern}$`).test(file);
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const projectRoot = path.resolve(options.path);

  log.heading("AnalyticsMap Validate");

  const plan = loadPlan(projectRoot);
  if (!plan) {
    log.error("No tracking plan found. Run 'analyticsmap scan' first.");
    if (options.ci) process.exit(1);
    return;
  }

  const rules = loadRules(projectRoot);
  if (rules.length === 0) {
    log.warn("No rules defined in .analyticsmap/rules.yml");
    log.dim("Create rules with 'analyticsmap ui' or edit the YAML directly.");
    return;
  }

  const results: RuleResult[] = [];

  for (const rule of rules) {
    const matchingEvents = plan.events.filter((e: PlanEvent) =>
      matchesScope(e.file, rule.scope)
    );

    const tracked = matchingEvents.filter((e: PlanEvent) => e.status === "active");
    const missing = matchingEvents.filter((e: PlanEvent) => e.status === "missing");
    const total = tracked.length + missing.length;
    const coverage = total > 0 ? Math.round((tracked.length / total) * 100) : 100;

    let status: "pass" | "fail" = "pass";
    const details: string[] = [];

    if (rule.minCoverage && coverage < rule.minCoverage) {
      status = "fail";
      details.push(
        `Coverage ${coverage}% is below minimum ${rule.minCoverage}%`
      );
    }

    if (rule.element && rule.element !== "all") {
      const untracked = missing.filter((e: PlanEvent) => e.element === rule.element);
      if (untracked.length > 0) {
        status = "fail";
        details.push(
          `${untracked.length} untracked ${rule.element} elements: ${untracked.map((e: PlanEvent) => e.file + ":" + e.line).join(", ")}`
        );
      }
    }

    results.push({
      rule,
      status,
      passCount: tracked.length,
      failCount: missing.length,
      details,
    });
  }

  const validation: ValidationResult = {
    totalRules: rules.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    warnings: results.filter(
      (r) => r.status === "fail" && r.rule.severity === "warning"
    ).length,
    errors: results.filter(
      (r) => r.status === "fail" && r.rule.severity === "error"
    ).length,
    results,
  };

  // Display results
  console.log("");
  for (const result of results) {
    const icon = result.status === "pass" ? chalk.green("✓") : chalk.red("✗");
    const severity =
      result.rule.severity === "error" ? chalk.red("[ERROR]") : chalk.yellow("[WARN]");
    console.log(
      `  ${icon} ${result.rule.name} ${result.status === "fail" ? severity : ""}`
    );
    for (const detail of result.details) {
      log.dim(`    ${detail}`);
    }
  }

  console.log("");
  console.log(
    `  Rules: ${validation.passed} passed, ${validation.failed} failed (${validation.errors} errors, ${validation.warnings} warnings)`
  );

  if (options.ci && validation.errors > 0) {
    log.error("Validation failed with errors. Exiting with code 1.");
    process.exit(1);
  }
}
