#!/usr/bin/env node

import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";
import { mapCommand } from "./commands/map.js";
import { validateCommand } from "./commands/validate.js";
import { uiCommand } from "./commands/ui.js";

const program = new Command();

program
  .name("analyticsmap")
  .description(
    "Analytics governance for mobile apps. Scan, map, and track analytics coverage."
  )
  .version("0.1.0");

program
  .command("scan")
  .description("Analyze analytics coverage for a feature (or all)")
  .option("-p, --path <path>", "Project root path", process.cwd())
  .option("-f, --feature <name>", "Analyze a specific feature")
  .option("--all", "Analyze all features")
  .action(scanCommand);

program
  .command("map")
  .description("Detect and group files by business feature")
  .option("-p, --path <path>", "Project root path", process.cwd())
  .option("--init", "Initialize .analyticsmap/ config if not present")
  .action(mapCommand);

program
  .command("validate")
  .description("Validate tracking plan against codebase (CI mode)")
  .option("-p, --path <path>", "Project root path", process.cwd())
  .option("--ci", "Exit with code 1 on failures")
  .action(validateCommand);

program
  .command("ui")
  .description("Open visual dashboard in browser")
  .option("-p, --path <path>", "Project root path", process.cwd())
  .option("--port <port>", "Server port", "4821")
  .action(uiCommand);

program.parse();
