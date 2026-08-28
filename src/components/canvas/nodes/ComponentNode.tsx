"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion } from "framer-motion";
import type { ComponentNodeData } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { Server } from "lucide-react";
import { ICON_MAP } from "@/lib/icons";
import { AlertTriangle } from "lucide-react";
import { CATEGORY_STYLE } from "@/data/components";
import { AWS_REGIONS, isUnavailableInRegion } from "@/data/regionAvailability";
import { getComponentById } from "@/data/componentLookup";
import { awsIconUrl } from "@/lib/awsIcon";
import type { ComponentCategory } from "@/types/component";
import { useIsCoarsePointer } from "@/hooks/useBreakpoint";
import { useAppStore } from "@/store/appStore";

type ComponentNode = Node<ComponentNodeData, "component">;

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  idle: "bg-zinc-600",
};

function ComponentNodeInner({ id, data, selected }: NodeProps<ComponentNode>) {
  const nodeData = data;
  const Icon = ICON_MAP[nodeData.icon] ?? Server;
  const colors =
    CATEGORY_STYLE[nodeData.category as ComponentCategory] ?? CATEGORY_STYLE.compute;
  // Persisted node data is a snapshot and carries no awsIcon, so read the
  // current spec from the catalog.
  const iconUrl = awsIconUrl(getComponentById(nodeData.componentId));
  // Region availability is advisory: the node still simulates and scores
  // normally, it just carries a visible warning.
  const region = useAppStore((s) => s.region);
  const regionUnavailable = isUnavailableInRegion(nodeData.componentId, region);
  const status = (nodeData.status as string) ?? "idle";
  const statusDot = STATUS_DOT[status] ?? STATUS_DOT.idle;
  const isBottleneck = nodeData.isBottleneck ?? false;
  const replicas = nodeData.replicas ?? 1;
  const utilization = nodeData.utilization ?? 0;

  const isCustom = nodeData.componentId === "custom";
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const isCoarse = useIsCoarsePointer();
  // Off by default — the canvas stays quiet until the user asks for runtime
  // numbers via the "Node Details" switch in the top bar.
  const showDetails = useAppStore((s) => s.nodeDetailsVisible);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitLabel = useCallback(() => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== nodeData.label) {
      updateNodeData(id, { label: trimmed });
    } else {
      setEditLabel(nodeData.label);
    }
    setEditing(false);
  }, [editLabel, nodeData.label, id, updateNodeData]);

  const handleDoubleClick = useCallback(() => {
    if (!isCustom) return;
    setEditLabel(nodeData.label);
    setEditing(true);
  }, [isCustom, nodeData.label]);

  // Touch devices have no double-click: a tap on the label of an
  // already-selected custom node enters rename mode.
  const handleLabelClick = useCallback(() => {
    if (!isCoarse || !selected || !isCustom || editing) return;
    setEditLabel(nodeData.label);
    setEditing(true);
  }, [isCoarse, selected, isCustom, editing, nodeData.label]);

  return (
    <div
      className={`
        group relative flex flex-col items-center gap-1 rounded-xl border bg-zinc-900 px-4 py-3
        shadow-[var(--shadow-e2)] transition-[border-color,box-shadow] duration-150
        ${isBottleneck
          ? "border-rose-500/60 ring-2 ring-rose-500/20"
          : selected
            ? "border-cyan-500/80 ring-2 ring-cyan-500/30"
            : "border-zinc-700/70 hover:border-zinc-600"}
      `}
    >
      {/* Status indicator dot */}
      {showDetails && (
        <div
          className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-900 ${statusDot}`}
          style={{ animation: status !== 'idle' ? 'status-pulse 2s infinite' : 'none' }}
        />
      )}

      {/* Icon + Label row */}
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.chip} ${colors.icon} ${colors.ring}`}>
          {iconUrl ? (
            // Decorative: the node's label already names the service.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" aria-hidden className="h-4 w-4" draggable={false} />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        {regionUnavailable && (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-amber-400"
            aria-label={`Not available in ${region}`}
          >
            <title>
              {`Not available in ${AWS_REGIONS.find((r) => r.code === region)?.label ?? region}`}
            </title>
          </AlertTriangle>
        )}
        {editing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") {
                setEditLabel(nodeData.label);
                setEditing(false);
              }
            }}
            className="nodrag max-w-[80px] bg-transparent text-[11px] font-medium text-zinc-200 outline-none border-b border-cyan-500"
          />
        ) : (
          <span
            className={`max-w-[96px] whitespace-normal break-words text-center text-[11px] font-medium leading-tight text-zinc-200 ${isCustom ? "cursor-text" : ""}`}
            onDoubleClick={handleDoubleClick}
            onClick={handleLabelClick}
          >
            {nodeData.label}
          </span>
        )}
      </div>

      {/* Stats */}
      {showDetails && (
        <span className="font-mono text-[10px] text-zinc-400">
          {nodeData.maxQPS === Infinity ? '\u221e' : ((nodeData.maxQPS ?? 0)/1000).toFixed(0) + 'k'} qps
        </span>
      )}

      {/* Replicas badge */}
      {replicas > 1 && (
        <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold text-white">
          ×{replicas}
        </span>
      )}

      {/* Utilization bar (shown during simulation) */}
      {showDetails && utilization > 0 && (
        <div className="mt-0.5 flex w-full items-center gap-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className={`h-full rounded-full ${
                utilization > 0.8 ? "bg-rose-500" : utilization > 0.5 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(utilization * 100, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className={`font-mono text-[10px] ${
            utilization > 0.8 ? "text-rose-400" : utilization > 0.5 ? "text-amber-400" : "text-emerald-400"
          }`}>{(utilization * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Handles — larger visual size on touch devices (44px hit area via CSS ::after) */}
      <Handle
        type="target"
        position={Position.Left}
        className={`${isCoarse ? "!h-5 !w-5" : "!h-2 !w-2"} !rounded-full !border !border-zinc-600 !bg-zinc-400`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`${isCoarse ? "!h-5 !w-5" : "!h-2 !w-2"} !rounded-full !border !border-zinc-600 !bg-zinc-400`}
      />
    </div>
  );
}

function areComponentNodePropsEqual(
  prev: NodeProps<ComponentNode>,
  next: NodeProps<ComponentNode>
): boolean {
  if (prev.selected !== next.selected) return false;
  const p = prev.data;
  const n = next.data;
  return (
    p.componentId === n.componentId &&
    p.label === n.label &&
    p.status === n.status &&
    p.replicas === n.replicas &&
    p.utilization === n.utilization &&
    p.maxQPS === n.maxQPS &&
    p.latencyMs === n.latencyMs &&
    p.category === n.category &&
    p.icon === n.icon &&
    p.isBottleneck === n.isBottleneck
  );
}

export const ComponentNode = memo(ComponentNodeInner, areComponentNodePropsEqual);
