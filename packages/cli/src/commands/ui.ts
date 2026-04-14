import * as path from "node:path";
import { startServer } from "../server/apiServer.js";
import { loadFeatures } from "../plan/featuresStore.js";
import { log } from "../lib/logger.js";

interface UiOptions {
  path: string;
  port: string;
}

export async function uiCommand(options: UiOptions): Promise<void> {
  const projectRoot = path.resolve(options.path);
  const port = parseInt(options.port, 10);

  const features = loadFeatures(projectRoot);

  log.heading("AnalyticsMap Dashboard");
  log.dim(`Project: ${projectRoot}`);
  log.dim(`Features: ${features?.length ?? 0} (map from dashboard if none)`);

  await startServer(projectRoot, port);
}
