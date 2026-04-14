const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  getProject: () => fetchJson<ProjectData>("/project"),
  getFeatures: () => fetchJson<FeatureData[]>("/features"),
  getFiles: () => fetchJson<FileTreeNode[]>("/files"),
  getFile: (path: string) => fetchJson<FileData>(`/file/${encodeURIComponent(path)}`),
  analyzeFeature: (featureId: string) => postJson<FeatureData>(`/analyze/${featureId}`),
  mapFeatures: () => postJson<FeatureData[]>("/map"),
  getCodeContext: (file: string, line: number, suggestedEvent: string, suggestedProps: Record<string, string>) =>
    postJson<CodeContextData>("/code-context", { file, line, suggestedEvent, suggestedProps }),
};

export interface ProjectData {
  name: string;
  platform: string;
  totalFiles: number;
  totalInteractions: number;
  trackedInteractions: number;
  coveragePercent: number;
}

export interface FeatureData {
  id: string;
  name: string;
  icon: string;
  files: string[];
  analysisStatus: "pending" | "analyzing" | "done" | "error";
  trackedCount: number;
  missingCount: number;
  coveragePercent: number;
  interactions: InteractionData[];
}

export interface InteractionData {
  id: string;
  file: string;
  line: number;
  element: string;
  description: string;
  suggestedEvent: string;
  suggestedProps: Record<string, string>;
  tracked: boolean;
  existingEvent?: string;
  detectedProvider?: string;
}

export interface CodeContextData {
  before: string[];
  targetLine: string;
  after: string[];
  preview: string[];
}

export interface ProviderSummaryData {
  provider: string;
  eventCount: number;
  files: string[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  tracked: number;
  missing: number;
  children?: FileTreeNode[];
}

export interface FileData {
  path: string;
  content: string;
  interactions: InteractionData[];
}
