import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import type { AnalyticsMapConfig, Platform } from "@analyticsmap/shared";

export interface ScannedFile {
  path: string;
  relativePath: string;
  content: string;
  extension: string;
  sizeBytes: number;
}

const PLATFORM_EXTENSIONS: Record<Platform, string[]> = {
  "react-native": [".tsx", ".jsx", ".ts", ".js"],
  "react-web": [".tsx", ".jsx", ".ts", ".js"],
  swift: [".swift"],
  kotlin: [".kt", ".kts"],
  flutter: [".dart"],
  auto: [".tsx", ".jsx", ".ts", ".js", ".swift", ".kt", ".kts", ".dart"],
};

const MAX_FILE_SIZE = 100 * 1024; // 100KB — skip huge files

export async function scanFiles(
  projectRoot: string,
  config: AnalyticsMapConfig
): Promise<ScannedFile[]> {
  const extensions = PLATFORM_EXTENSIONS[config.platform] ?? PLATFORM_EXTENSIONS.auto;
  const patterns = extensions.map((ext) => `**/*${ext}`);

  const ignorePatterns = [
    ...config.ignore,
    "**/node_modules/**",
    "**/dist/**",
    "**/.analyticsmap/**",
  ];

  const filePaths = await glob(patterns, {
    cwd: projectRoot,
    ignore: ignorePatterns,
    nodir: true,
    absolute: false,
  });

  const files: ScannedFile[] = [];

  for (const relativePath of filePaths) {
    const fullPath = path.join(projectRoot, relativePath);

    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const extension = path.extname(relativePath);

      files.push({
        path: fullPath,
        relativePath,
        content,
        extension,
        sizeBytes: stat.size,
      });
    } catch {
      // Skip files we can't read
    }
  }

  return files;
}

export function detectPlatform(files: ScannedFile[]): Platform {
  const extensions = new Set(files.map((f) => f.extension));
  const hasPackageJson = files.some((f) => f.relativePath === "package.json");

  if (extensions.has(".dart")) return "flutter";
  if (extensions.has(".swift")) return "swift";
  if (extensions.has(".kt") || extensions.has(".kts")) return "kotlin";

  if (hasPackageJson) {
    const pkgFile = files.find((f) => f.relativePath === "package.json");
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content);
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };
        if (deps["react-native"] || deps["expo"]) return "react-native";
        if (deps["react"]) return "react-web";
      } catch {
        // ignore parse errors
      }
    }
  }

  return "auto";
}
