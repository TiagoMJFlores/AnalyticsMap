import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useFeatures } from "../hooks/useFeatures.ts";
import { api, type FileData, type InteractionData } from "../lib/api.ts";

function FileTree({
  features,
  selectedFile,
  onSelect,
}: {
  features: { name: string; icon: string; files: string[]; interactions: InteractionData[] }[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      {features.map((feature) => (
        <div key={feature.name}>
          <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            <span>{feature.icon}</span> {feature.name}
          </h3>
          <ul className="space-y-0.5">
            {feature.files.map((file) => {
              const fileInteractions = feature.interactions?.filter(
                (i) => i.file === file
              ) || [];
              const tracked = fileInteractions.filter((i) => i.tracked).length;
              const missing = fileInteractions.filter((i) => !i.tracked).length;
              const total = tracked + missing;
              const isSelected = file === selectedFile;

              return (
                <li key={file}>
                  <button
                    onClick={() => onSelect(file)}
                    className={`w-full text-left text-xs font-mono px-2 py-1.5 rounded flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                        : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{file.split("/").pop()}</span>
                    {total > 0 && (
                      <span className={`flex-shrink-0 ${missing > 0 ? "text-red-400" : "text-green-400"}`}>
                        {tracked}/{total}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function InteractionList({ interactions }: { interactions: InteractionData[] }) {
  if (interactions.length === 0) {
    return <p className="text-slate-500 text-sm">No interactions in this file</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">
        Events ({interactions.length})
      </h3>
      {interactions.map((i) => (
        <div
          key={i.id}
          className={`text-xs p-2 rounded-lg border ${
            i.tracked
              ? "border-green-500/20 bg-green-500/5"
              : "border-red-500/20 bg-red-500/5"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>{i.tracked ? "\u2705" : "\u274C"}</span>
            <span className="font-mono text-slate-200">
              {i.tracked ? i.existingEvent : i.suggestedEvent}
            </span>
          </div>
          <div className="text-slate-400 mt-0.5">
            line {i.line} - {i.description}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Files() {
  const { filePath } = useParams<{ filePath: string }>();
  const { features } = useFeatures();
  const [selectedFile, setSelectedFile] = useState<string | null>(
    filePath ? decodeURIComponent(filePath) : null
  );
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    if (!selectedFile) return;
    setLoadingFile(true);
    api
      .getFile(selectedFile)
      .then(setFileData)
      .catch(() => setFileData(null))
      .finally(() => setLoadingFile(false));
  }, [selectedFile]);

  const analyzedFeatures = features.filter((f) => f.analysisStatus === "done");
  const allFeatures = features.map((f) => ({
    name: f.name,
    icon: f.icon,
    files: f.files,
    interactions: f.interactions || [],
  }));

  // Monaco decorations for tracked/missing lines
  const handleEditorDidMount = (editor: unknown, monaco: unknown) => {
    if (!fileData || !editor || !monaco) return;
    const m = monaco as { editor: { TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: number } }; Range: new (a: number, b: number, c: number, d: number) => unknown };
    const e = editor as { deltaDecorations: (old: unknown[], decorations: unknown[]) => void };

    const decorations = fileData.interactions.map((interaction) => ({
      range: new m.Range(interaction.line, 1, interaction.line, 1),
      options: {
        isWholeLine: true,
        className: interaction.tracked
          ? "bg-green-500/10"
          : "bg-red-500/10",
        glyphMarginClassName: interaction.tracked
          ? "bg-green-500 rounded-full w-2 h-2 mt-1.5 ml-1"
          : "bg-red-500 rounded-full w-2 h-2 mt-1.5 ml-1",
        stickiness: m.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }));

    e.deltaDecorations([], decorations);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* File tree sidebar */}
      <div className="w-64 flex-shrink-0 bg-slate-800 rounded-xl border border-slate-700 p-3 overflow-y-auto">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Files</h2>
        <FileTree
          features={allFeatures}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
        />
      </div>

      {/* Code view */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedFile ? (
          <>
            <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 overflow-hidden">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Loading...
                </div>
              ) : fileData ? (
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={fileData.content}
                  theme="vs-dark"
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    glyphMargin: true,
                    scrollBeyondLastLine: false,
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  File not available
                </div>
              )}
            </div>

            {/* Interaction list below editor */}
            {fileData && fileData.interactions.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 max-h-48 overflow-y-auto">
                <InteractionList interactions={fileData.interactions} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500">
            Select a file to view code and tracking status
          </div>
        )}
      </div>
    </div>
  );
}
