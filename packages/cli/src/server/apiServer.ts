import express from "express";
import cors from "cors";
import * as path from "node:path";
import * as fs from "node:fs";
import open from "open";
import { loadConfig } from "../config.js";
import { loadFeatures, updateFeature } from "../plan/featuresStore.js";
import { loadPlan } from "../plan/trackingPlan.js";
import { scanFiles, detectPlatform } from "../analyzer/fileScanner.js";
import { analyzeFiles } from "../analyzer/llmAnalyzer.js";
import {
  savePlan,
  buildPlanFromInteractions,
} from "../plan/trackingPlan.js";
import { log } from "../lib/logger.js";
import type { Feature } from "@analyticsmap/shared";

export async function startServer(
  projectRoot: string,
  port: number = 4821
): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve UI static files (built Vite output)
  const uiDistPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
    "..",
    "ui",
    "dist"
  );
  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
  }

  // API: Project info
  app.get("/api/project", (_req, res) => {
    const config = loadConfig(projectRoot);
    const features = loadFeatures(projectRoot) ?? [];
    const analyzed = features.filter((f: Feature) => f.analysisStatus === "done");
    const totalTracked = analyzed.reduce((s: number, f: Feature) => s + f.trackedCount, 0);
    const totalMissing = analyzed.reduce((s: number, f: Feature) => s + f.missingCount, 0);
    const total = totalTracked + totalMissing;

    res.json({
      name: path.basename(projectRoot),
      platform: config.platform,
      totalFiles: features.reduce((s: number, f: Feature) => s + f.files.length, 0),
      totalInteractions: total,
      trackedInteractions: totalTracked,
      coveragePercent: total > 0 ? Math.round((totalTracked / total) * 100) : 0,
    });
  });

  // API: Map features (run feature detection)
  app.post("/api/map", async (_req, res) => {
    try {
      const config = loadConfig(projectRoot);
      const allFiles = await scanFiles(projectRoot, config);
      const platform =
        config.platform === "auto" ? detectPlatform(allFiles) : config.platform;

      const { groupByFeature } = await import("../analyzer/featureGrouper.js");
      const features = await groupByFeature(allFiles, []);

      const { saveFeatures: saveFeat } = await import("../plan/featuresStore.js");
      saveFeat(projectRoot, features);

      const { initConfig } = await import("../config.js");
      initConfig(projectRoot);

      res.json(features);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Feature mapping failed",
      });
    }
  });

  // API: Features list (returns empty array if no features yet)
  app.get("/api/features", (_req, res) => {
    const features = loadFeatures(projectRoot);
    res.json(features ?? []);
  });

  // API: Analyze a feature
  app.post("/api/analyze/:featureId", async (req, res) => {
    const { featureId } = req.params;
    const features = loadFeatures(projectRoot);
    if (!features) {
      return res.status(404).json({ error: "No features found" });
    }

    const feature = features.find((f: Feature) => f.id === featureId);
    if (!feature) {
      return res.status(404).json({ error: "Feature not found" });
    }

    try {
      const config = loadConfig(projectRoot);
      const allFiles = await scanFiles(projectRoot, config);
      const platform =
        config.platform === "auto" ? detectPlatform(allFiles) : config.platform;

      const featureFiles = allFiles.filter((f) =>
        feature.files.includes(f.relativePath)
      );

      const interactions = await analyzeFiles(featureFiles, config, platform);

      const tracked = interactions.filter((i) => i.tracked).length;
      const missing = interactions.filter((i) => !i.tracked).length;
      const total = tracked + missing;

      const updated: Partial<Feature> = {
        analysisStatus: "done",
        interactions,
        trackedCount: tracked,
        missingCount: missing,
        coveragePercent: total > 0 ? Math.round((tracked / total) * 100) : 100,
      };

      updateFeature(projectRoot, featureId, updated);

      // Update tracking plan
      const existingPlan = loadPlan(projectRoot);
      const plan = buildPlanFromInteractions(interactions, platform, existingPlan);
      savePlan(projectRoot, plan);

      // Return updated feature
      const refreshed = loadFeatures(projectRoot);
      const result = refreshed?.find((f: Feature) => f.id === featureId);
      res.json(result);
    } catch (err) {
      updateFeature(projectRoot, featureId, { analysisStatus: "error" });
      res.status(500).json({
        error: err instanceof Error ? err.message : "Analysis failed",
      });
    }
  });

  // API: File content + interactions
  app.get("/api/file/:filePath", (req, res) => {
    const filePath = decodeURIComponent(req.params.filePath);
    const fullPath = path.join(projectRoot, filePath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const features = loadFeatures(projectRoot) ?? [];
    const interactions = features
      .flatMap((f: Feature) => f.interactions ?? [])
      .filter((i) => i.file === filePath);

    res.json({ path: filePath, content, interactions });
  });

  // API: Code context with preview (uses LLM for correct insertion)
  app.post("/api/code-context", async (req, res) => {
    const { file, line, suggestedEvent, suggestedProps } = req.body;
    const fullPath = path.join(projectRoot, file);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const allLines = content.split("\n");
    const lineIndex = line - 1;
    const CONTEXT = 5;

    const start = Math.max(0, lineIndex - CONTEXT);
    const end = Math.min(allLines.length, lineIndex + CONTEXT + 1);
    const before = allLines.slice(Math.max(0, lineIndex - CONTEXT), lineIndex);
    const targetLine = allLines[lineIndex] ?? "";
    const after = allLines.slice(lineIndex + 1, lineIndex + 1 + CONTEXT);

    const codeSnippet = allLines.slice(start, end).join("\n");
    const config = loadConfig(projectRoot);

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic();

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `You are adding an analytics tracking call to this code. The tracking function is "${config.trackingFunction}".

Event to add: ${config.trackingFunction}('${suggestedEvent}'${Object.keys(suggestedProps ?? {}).length > 0 ? `, ${JSON.stringify(suggestedProps)}` : ""})

The interaction is at line ${line}: ${targetLine.trim()}

Here is the surrounding code (lines ${start + 1}-${end}):
\`\`\`
${codeSnippet}
\`\`\`

Insert the tracking call in the correct place following the language's syntax rules. The tracking should fire when the user interaction happens (e.g., inside a click handler, at the start of a function body, before a return, etc.).

Return ONLY the modified code snippet with the tracking call added. No explanation, no markdown fences. Just the code.`
        }],
      });

      const previewCode = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .replace(/^```\w*\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      const preview = previewCode.split("\n");

      res.json({ before, targetLine, after, preview });
    } catch {
      // Fallback: simple insertion before target line
      const indent = targetLine.match(/^(\s*)/)?.[1] ?? "    ";
      const propsStr = Object.keys(suggestedProps ?? {}).length > 0
        ? `, ${JSON.stringify(suggestedProps)}`
        : "";
      const trackingLine = `${indent}${config.trackingFunction}('${suggestedEvent}'${propsStr});`;
      const preview = [...before, trackingLine, targetLine, ...after];

      res.json({ before, targetLine, after, preview });
    }
  });

  // SPA fallback: serve index.html for non-API routes
  app.get("/{*splat}", (_req, res) => {
    const indexPath = path.join(uiDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: "UI not built. Run 'pnpm --filter @analyticsmap/ui build' first.",
      });
    }
  });

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    log.success(`Dashboard running at ${url}`);
    open(url);
  });
}
