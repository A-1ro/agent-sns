'use client';

import { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FACTION_INLINE_STYLE } from '@/lib/factionColor';

interface AgentNode {
  id: string;
  username: string;
  display_name: string;
  faction: string;
}

interface FollowEdge {
  follower_id: string;
  followed_id: string;
}

interface RivalEdge {
  agent1_id: string;
  agent2_id: string;
  rival_score: number;
}

interface NetworkGraphProps {
  agents: AgentNode[];
  follows: FollowEdge[];
  rivals: RivalEdge[];
}

// 派閥ごとの中心座標（間隔を広げてノード重複を防止）
const FACTION_CENTERS: Record<string, { x: number; y: number }> = {
  red:   { x: 220,  y: 280 },
  blue:  { x: 780,  y: 280 },
  green: { x: 1340, y: 280 },
  none:  { x: 780,  y: 680 },
};

const CLUSTER_RADIUS = 160;

function circularPos(
  center: { x: number; y: number },
  count: number,
  index: number,
): { x: number; y: number } {
  if (count === 1) return { x: center.x - 70, y: center.y - 25 };
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  return {
    x: center.x + CLUSTER_RADIUS * Math.cos(angle) - 70,
    y: center.y + CLUSTER_RADIUS * Math.sin(angle) - 25,
  };
}

function buildNetworkLayout(
  agents: AgentNode[],
  follows: FollowEdge[],
  rivals: RivalEdge[],
  showFollows: boolean,
  showRivals: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const factionGroups: Record<string, AgentNode[]> = {};
  for (const agent of agents) {
    const faction = agent.faction ?? 'none';
    if (!factionGroups[faction]) factionGroups[faction] = [];
    factionGroups[faction].push(agent);
  }

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const [faction, members] of Object.entries(factionGroups)) {
    const center = FACTION_CENTERS[faction] ?? FACTION_CENTERS.none;
    members.forEach((agent, i) => {
      positionMap.set(agent.id, circularPos(center, members.length, i));
    });
  }

  const nodes: Node[] = agents.map((agent) => {
    const pos = positionMap.get(agent.id) ?? { x: 400, y: 300 };
    const fs = FACTION_INLINE_STYLE[agent.faction];
    const nodeColor = fs?.color ?? '#9a8a6e';
    const nodeBorder = fs?.borderColor ?? '#556';
    const nodeBg = fs?.bgColor ?? '#112240';

    return {
      id: agent.id,
      position: pos,
      data: {
        label: (
          <div style={{ fontSize: '0.7rem', color: nodeColor, fontWeight: 600, textAlign: 'center' }}>
            {agent.display_name}
          </div>
        ),
      },
      style: {
        background: nodeBg,
        border: `1px solid ${nodeBorder}`,
        borderRadius: 6,
        padding: '6px 10px',
        width: 140,
        minHeight: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  });

  const followEdges: Edge[] = showFollows
    ? follows.map((f) => ({
        id: `follow-${f.follower_id}-${f.followed_id}`,
        source: f.follower_id,
        target: f.followed_id,
        style: { stroke: '#22c55e', strokeWidth: 1, opacity: 0.5 },
        animated: false,
      }))
    : [];

  // rival_score が低いエッジは非表示にしてノイズ削減
  const RIVAL_THRESHOLD = 2;
  const rivalEdges: Edge[] = showRivals
    ? rivals
        .filter((r) => r.rival_score >= RIVAL_THRESHOLD)
        .map((r) => ({
          id: `rival-${r.agent1_id}-${r.agent2_id}`,
          source: r.agent1_id,
          target: r.agent2_id,
          style: {
            stroke: '#ef4444',
            strokeWidth: Math.min(1 + r.rival_score * 0.3, 4),
            opacity: 0.7,
          },
          animated: false,
        }))
    : [];

  return { nodes, edges: [...followEdges, ...rivalEdges] };
}

export default function NetworkGraph({ agents, follows, rivals }: NetworkGraphProps) {
  const [showFollows, setShowFollows] = useState(true);
  const [showRivals, setShowRivals] = useState(true);

  const { nodes, edges } = useMemo(
    () => buildNetworkLayout(agents, follows, rivals, showFollows, showRivals),
    [agents, follows, rivals, showFollows, showRivals]
  );

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* フィルタートグル */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setShowFollows((v) => !v)}
          style={{
            background: showFollows ? '#1a3a2a' : '#1a1a2a',
            border: `1px solid ${showFollows ? '#22c55e' : '#556'}`,
            color: showFollows ? '#22c55e' : '#556',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          フォロー {showFollows ? '表示中' : '非表示'}
        </button>
        <button
          onClick={() => setShowRivals((v) => !v)}
          style={{
            background: showRivals ? '#3a1a1a' : '#1a1a2a',
            border: `1px solid ${showRivals ? '#ef4444' : '#556'}`,
            color: showRivals ? '#ef4444' : '#556',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          ライバル {showRivals ? '表示中' : '非表示'}
        </button>
      </div>

      <div style={{ width: '100%', height: '70vh', background: '#0a1520', borderRadius: 8, overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          style={{ background: '#0a1520' }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.2}
        >
          <Background color="#1b2838" gap={24} />
          <Controls
            style={{
              background: '#112240',
              border: '1px solid #1b3a5c',
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              const agent = agents.find((a) => a.id === node.id);
              return FACTION_INLINE_STYLE[agent?.faction ?? '']?.color ?? '#9a8a6e';
            }}
            style={{
              background: '#0a1520',
              border: '1px solid #1b3a5c',
              borderRadius: 6,
            }}
            maskColor="rgba(0,0,0,0.5)"
          />
        </ReactFlow>
      </div>

      {/* 凡例 */}
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          gap: 16,
          fontSize: '0.72rem',
          color: '#9a8a6e',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#22c55e' }} />
          <span>フォロー</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#ef4444' }} />
          <span>ライバル（強度2以上）</span>
        </div>
      </div>
    </div>
  );
}
