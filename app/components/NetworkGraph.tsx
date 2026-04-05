'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FACTION_INLINE_STYLE } from '@/lib/factionColor';

interface AgentNode {
  id: number;
  username: string;
  display_name: string;
  faction: string;
}

interface FollowEdge {
  follower_id: number;
  followed_id: number;
}

interface RivalEdge {
  agent1_id: number;
  agent2_id: number;
  rival_score: number;
}

interface NetworkGraphProps {
  agents: AgentNode[];
  follows: FollowEdge[];
  rivals: RivalEdge[];
}

// 派閥ごとの初期 X クラスタ位置
const FACTION_X: Record<string, number> = {
  red: 0,
  blue: 400,
  green: 800,
  none: 400,
};

// 派閥ごとの初期 Y クラスタ位置
const FACTION_Y: Record<string, number> = {
  red: 100,
  blue: 100,
  green: 100,
  none: 500,
};

function buildNetworkLayout(
  agents: AgentNode[],
  follows: FollowEdge[],
  rivals: RivalEdge[]
): { nodes: Node[]; edges: Edge[] } {
  // 派閥ごとにエージェントをグループ化して配置
  const factionGroups: Record<string, AgentNode[]> = {};
  for (const agent of agents) {
    const faction = agent.faction ?? 'none';
    if (!factionGroups[faction]) factionGroups[faction] = [];
    factionGroups[faction].push(agent);
  }

  const NODE_W = 140;
  const NODE_H = 50;
  const H_GAP = 20;
  const V_GAP = 20;
  const COLS = 3;

  const positionMap = new Map<number, { x: number; y: number }>();

  for (const [faction, members] of Object.entries(factionGroups)) {
    const baseX = FACTION_X[faction] ?? 400;
    const baseY = FACTION_Y[faction] ?? 100;
    members.forEach((agent, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      positionMap.set(agent.id, {
        x: baseX + col * (NODE_W + H_GAP),
        y: baseY + row * (NODE_H + V_GAP),
      });
    });
  }

  const nodes: Node[] = agents.map((agent) => {
    const pos = positionMap.get(agent.id) ?? { x: 400, y: 300 };
    const fs = FACTION_INLINE_STYLE[agent.faction];
    const nodeColor = fs?.color ?? '#9a8a6e';
    const nodeBorder = fs?.borderColor ?? '#556';
    const nodeBg = fs?.bgColor ?? '#112240';

    return {
      id: String(agent.id),
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
        width: NODE_W,
        minHeight: NODE_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    };
  });

  const followEdges: Edge[] = follows.map((f) => ({
    id: `follow-${f.follower_id}-${f.followed_id}`,
    source: String(f.follower_id),
    target: String(f.followed_id),
    style: { stroke: '#22c55e', strokeWidth: 1.5 },
    animated: false,
    label: '',
  }));

  const rivalEdges: Edge[] = rivals.map((r) => ({
    id: `rival-${r.agent1_id}-${r.agent2_id}`,
    source: String(r.agent1_id),
    target: String(r.agent2_id),
    style: { stroke: '#ef4444', strokeWidth: Math.min(1 + r.rival_score * 0.3, 4) },
    animated: true,
    label: String(r.rival_score),
    labelStyle: { fill: '#ef4444', fontSize: 10 },
  }));

  return { nodes, edges: [...followEdges, ...rivalEdges] };
}

export default function NetworkGraph({ agents, follows, rivals }: NetworkGraphProps) {
  const { nodes, edges } = useMemo(
    () => buildNetworkLayout(agents, follows, rivals),
    [agents, follows, rivals]
  );

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ width: '100%', height: '70vh', background: '#0a1520', borderRadius: 8, overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={{ background: '#0a1520' }}
          nodesDraggable
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
      </div>
      {/* 凡例 */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'rgba(13,27,42,0.9)',
          border: '1px solid #1b3a5c',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: '0.72rem',
          color: '#9a8a6e',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#22c55e' }} />
          <span>フォロー</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: '#ef4444' }} />
          <span>ライバル（数値=強度）</span>
        </div>
      </div>
    </div>
  );
}
