import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import { useFeatures } from "../hooks/useFeatures.ts";
import type { FeatureData } from "../lib/api.ts";

function coverageColor(percent: number, status: string): string {
  if (status !== "done") return "#475569"; // slate-600
  if (percent >= 80) return "#22c55e";
  if (percent >= 50) return "#eab308";
  return "#ef4444";
}

function FeatureNode({ data }: { data: Record<string, unknown> }) {
  const percent = data.coveragePercent as number;
  const status = data.analysisStatus as string;
  const color = coverageColor(percent, status);
  const isDone = status === "done";
  const files = data.files as string[];

  return (
    <div
      className="bg-slate-800 rounded-xl border-2 px-5 py-4 min-w-[160px] text-center shadow-lg"
      style={{ borderColor: color }}
    >
      <div className="text-2xl mb-1">{data.icon as string}</div>
      <div className="text-sm font-semibold text-white">{data.name as string}</div>
      <div className="text-xs text-slate-400 mt-1">
        {files.length} files
      </div>
      {isDone && (
        <div className="text-xs font-mono mt-2" style={{ color }}>
          {percent}% coverage
        </div>
      )}
    </div>
  );
}

function FileNode({ data }: { data: { label: string; tracked: number; missing: number } }) {
  const hasData = data.tracked + data.missing > 0;
  return (
    <div className="bg-slate-700/80 rounded-lg border border-slate-600 px-3 py-2 text-xs">
      <div className="text-slate-200 font-mono">{data.label}</div>
      {hasData && (
        <div className="mt-1 text-slate-400">
          <span className="text-green-400">{data.tracked}</span>
          {" / "}
          <span>{data.tracked + data.missing}</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  feature: FeatureNode as unknown as NodeTypes["feature"],
  file: FileNode as unknown as NodeTypes["file"],
};

export default function FeatureMap() {
  const { features, loading, error } = useFeatures();
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const FILE_HEIGHT = 40;
    const FILE_GAP = 8;
    const FEATURE_GAP = 60;
    const FILE_X = 350;
    let currentY = 0;

    features.forEach((feature) => {
      const fileCount = feature.files.length;
      const filesBlockHeight = fileCount * (FILE_HEIGHT + FILE_GAP);
      const featureCenterY = currentY + filesBlockHeight / 2 - 50;

      nodes.push({
        id: `feature-${feature.id}`,
        type: "feature",
        position: { x: 0, y: featureCenterY },
        data: { ...feature } as Record<string, unknown>,
        sourcePosition: Position.Right,
      });

      feature.files.forEach((file, ffi) => {
        const fileId = `file-${feature.id}-${ffi}`;
        const fileName = file.split("/").pop() || file;

        const interaction = feature.interactions?.filter((i) => i.file === file) || [];
        const tracked = interaction.filter((i) => i.tracked).length;
        const missing = interaction.filter((i) => !i.tracked).length;

        nodes.push({
          id: fileId,
          type: "file",
          position: { x: FILE_X, y: currentY + ffi * (FILE_HEIGHT + FILE_GAP) },
          data: { label: fileName, path: file, tracked, missing },
          targetPosition: Position.Left,
        });

        edges.push({
          id: `edge-${feature.id}-${ffi}`,
          source: `feature-${feature.id}`,
          target: fileId,
          type: "smoothstep",
          style: {
            stroke: coverageColor(feature.coveragePercent, feature.analysisStatus),
            strokeWidth: 1.5,
          },
          animated: feature.analysisStatus === "analyzing",
        });
      });

      currentY += filesBlockHeight + FEATURE_GAP;
    });

    return { nodes, edges };
  }, [features]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "file" && node.data.path) {
        navigate(`/files/${encodeURIComponent(node.data.path as string)}`);
      }
    },
    [navigate]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-slate-400">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-400 text-center">{error}</div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)] bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#334155" gap={20} />
        <Controls
          className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300"
        />
      </ReactFlow>

      <div className="absolute bottom-4 left-4 flex gap-4 text-xs text-slate-400 bg-slate-800/90 px-3 py-2 rounded-lg border border-slate-700">
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1" /> &gt;80%</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1" /> 50-80%</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" /> &lt;50%</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-slate-600 mr-1" /> Not analyzed</span>
      </div>
    </div>
  );
}
