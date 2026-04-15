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

  const uiDistPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
    "..",
    "ui",
    "dist"
  );

  // API: Detect providers (no LLM needed, instant)
  app.get("/api/providers", async (_req, res) => {
    try {
      const config = loadConfig(projectRoot);
      const files = await scanFiles(projectRoot, config);
      const { detectProviders } = await import("../analyzer/providerDetector.js");
      const providers = detectProviders(files);
      res.json(providers);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Provider detection failed",
      });
    }
  });

  // API: Analytics health check (no LLM needed)
  app.get("/api/health-check", async (_req, res) => {
    try {
      const config = loadConfig(projectRoot);
      const files = await scanFiles(projectRoot, config);
      const { detectProviders } = await import("../analyzer/providerDetector.js");
      const { checkAnalyticsHealth } = await import("../analyzer/healthChecker.js");
      const providers = detectProviders(files);
      const report = checkAnalyticsHealth(files, providers);
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Health check failed",
      });
    }
  });

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

  // API: Code context with preview
  app.post("/api/code-context", async (req, res) => {
    const { file, line, suggestedEvent, suggestedProps, existingEvent, tracked } = req.body;
    const fullPath = path.join(projectRoot, file);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const allLines = content.split("\n");
    const CONTEXT = 5;

    // For tracked events, find the exact line with THIS event's tracking call
    let actualLineIndex = line - 1;
    if (tracked && existingEvent) {
      const exactPatterns = [
        `'${existingEvent}'`,
        `"${existingEvent}"`,
      ];

      // Search the ENTIRE file for this exact event, pick closest to interaction line
      let bestMatch = -1;
      let bestDistance = Infinity;
      for (let i = 0; i < allLines.length; i++) {
        if (exactPatterns.some((p) => allLines[i].includes(p))) {
          const distance = Math.abs(i - (line - 1));
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = i;
          }
        }
      }
      if (bestMatch >= 0) actualLineIndex = bestMatch;
    }

    const before = allLines.slice(Math.max(0, actualLineIndex - CONTEXT), actualLineIndex);
    const targetLine = allLines[actualLineIndex] ?? "";
    const after = allLines.slice(actualLineIndex + 1, actualLineIndex + 1 + CONTEXT);

    // For missing events: use LLM to generate correct insertion
    let preview: string[] | undefined;
    if (!tracked) {
      const start = Math.max(0, actualLineIndex - CONTEXT);
      const end = Math.min(allLines.length, actualLineIndex + CONTEXT + 1);
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

Insert the tracking call in the correct place following the language's syntax rules. The tracking should fire when the user interaction happens.

Return ONLY the modified code snippet. No explanation, no markdown fences.`
          }],
        });

        const previewCode = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("")
          .replace(/^```\w*\n?/, "")
          .replace(/\n?```$/, "")
          .trim();

        preview = previewCode.split("\n");
      } catch {
        const indent = targetLine.match(/^(\s*)/)?.[1] ?? "    ";
        const config = loadConfig(projectRoot);
        const propsStr = Object.keys(suggestedProps ?? {}).length > 0
          ? `, ${JSON.stringify(suggestedProps)}`
          : "";
        const trackingLine = `${indent}${config.trackingFunction}('${suggestedEvent}'${propsStr});`;
        preview = [...before, trackingLine, targetLine, ...after];
      }
    }

    res.json({ before, targetLine, after, preview });
  });

  // API: Event-level feedback
  app.get("/api/event-feedback", (_req, res) => {
    const features = loadFeatures(projectRoot) ?? [];
    const allInteractions = features.flatMap((f: Feature) => f.interactions ?? []);

    if (allInteractions.length === 0) {
      return res.json([]);
    }

    import("../analyzer/eventChecker.js").then(({ checkEvents }) => {
      const feedback = checkEvents(allInteractions);
      res.json(feedback);
    }).catch((err) => {
      res.status(500).json({ error: err instanceof Error ? err.message : "Event check failed" });
    });
  });

  // Serve UI static files AFTER API routes
  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
  }

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
