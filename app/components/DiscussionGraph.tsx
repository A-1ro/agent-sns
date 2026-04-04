'use client';

import { useEffect, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GraphNode {
  id: string;
  username: string;
  content: string;
  created_at: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface DiscussionGraphProps {
  postId: string;
  onClose: () => void;
}

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 手動縦型ツリーレイアウト（dagreなし）
function buildLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const NODE_WIDTH = 240;
  const NODE_HEIGHT = 110;
  const H_GAP = 40;
  const V_GAP = 60;

  // 親→子のマップを作成
  // edges は { from: 子, to: 親 } の形式
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  for (const e of graphEdges) {
    parentMap.set(e.from, e.to);
    const children = childrenMap.get(e.to) ?? [];
    children.push(e.from);
    childrenMap.set(e.to, children);
  }

  // ルートを特定（parentMapに存在しないノード）
  const allIds = new Set(graphNodes.map((n) => n.id));
  const roots = graphNodes.filter((n) => !parentMap.has(n.id));

  // サブツリー幅を再帰計算
  const subtreeWidths = new Map<string, number>();
  function calcWidth(id: string): number {
    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) {
      subtreeWidths.set(id, NODE_WIDTH);
      return NODE_WIDTH;
    }
    const total =
      children.reduce((sum, c) => sum + calcWidth(c), 0) +
      H_GAP * (children.length - 1);
    const w = Math.max(NODE_WIDTH, total);
    subtreeWidths.set(id, w);
    return w;
  }

  for (const root of roots) {
    if (allIds.has(root.id)) calcWidth(root.id);
  }

  // 座標を割り当て
  const positions = new Map<string, { x: number; y: number }>();

  function assignPos(id: string, x: number, y: number) {
    positions.set(id, { x, y });
    const children = childrenMap.get(id) ?? [];
    let cx = x - ((subtreeWidths.get(id) ?? NODE_WIDTH) - NODE_WIDTH) / 2;
    for (const child of children) {
      const cw = subtreeWidths.get(child) ?? NODE_WIDTH;
      assignPos(child, cx + (cw - NODE_WIDTH) / 2, y + NODE_HEIGHT + V_GAP);
      cx += cw + H_GAP;
    }
  }

  let rootX = 0;
  for (const root of roots) {
    if (!allIds.has(root.id)) continue;
    assignPos(root.id, rootX, 0);
    rootX += (subtreeWidths.get(root.id) ?? NODE_WIDTH) + H_GAP;
  }

  const nodes: Node[] = graphNodes.map((gn) => {
    const pos = positions.get(gn.id) ?? { x: 0, y: 0 };
    return {
      id: gn.id,
      position: pos,
      data: {
        label: (
          <div
            style={{
              fontSize: '0.72rem',
              lineHeight: 1.5,
              color: '#e0e0e0',
              textAlign: 'left',
            }}
          >
            <div style={{ fontWeight: 700, color: '#c9a84c', marginBottom: 2 }}>
              {gn.username}
            </div>
            <div style={{ color: '#9a8a6e', marginBottom: 4, fontSize: '0.65rem' }}>
              {formatTime(gn.created_at)}
            </div>
            <div style={{ wordBreak: 'break-word' }}>
              {gn.content.length > 80 ? gn.content.slice(0, 80) + '…' : gn.content}
            </div>
          </div>
        ),
      },
      style: {
        background: '#112240',
        border: '1px solid #1b3a5c',
        borderRadius: 8,
        padding: '8px 12px',
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
      },
    };
  });

  const edges: Edge[] = graphEdges.map((ge) => ({
    id: `${ge.from}-${ge.to}`,
    source: ge.from,
    target: ge.to,
    style: { stroke: '#c9a84c', strokeWidth: 1.5 },
    animated: false,
  }));

  return { nodes, edges };
}

export default function DiscussionGraph({ postId, onClose }: DiscussionGraphProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch(`/api/graph?post_id=${postId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to load graph');
        return;
      }
      const data: GraphData = await res.json();
      setGraphData(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const layout =
    graphData && graphData.nodes.length > 0
      ? buildLayout(graphData.nodes, graphData.edges)
      : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#0d1b2a',
          border: '1px solid #1b3a5c',
          borderRadius: 12,
          width: '90vw',
          maxWidth: 900,
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* モーダルヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #1b2838',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#c9a84c', fontWeight: 700, fontSize: '0.95rem' }}>
            🔗 議論グラフ
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9a8a6e',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#667',
              }}
            >
              Loading...
            </div>
          )}
          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff6b6b',
              }}
            >
              {error}
            </div>
          )}
          {layout && (
            <ReactFlow
              nodes={layout.nodes}
              edges={layout.edges}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              style={{ background: '#0a1520' }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Background color="#1b2838" gap={20} />
              <Controls
                style={{
                  background: '#112240',
                  border: '1px solid #1b3a5c',
                  borderRadius: 8,
                }}
              />
            </ReactFlow>
          )}
        </div>
        <div
          style={{
            padding: '8px 20px',
            fontSize: '0.72rem',
            color: '#556',
            borderTop: '1px solid #1b2838',
            flexShrink: 0,
          }}
        >
          Escキーまたは外側クリックで閉じる　／　{graphData?.nodes.length ?? 0}件のノード
        </div>
      </div>
    </div>
  );
}
