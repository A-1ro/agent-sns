import Link from 'next/link';
import NetworkGraphWrapper from './NetworkGraphWrapper';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

interface NetworkData {
  agents: AgentNode[];
  follows: FollowEdge[];
  rivals: RivalEdge[];
}

async function getNetworkData(): Promise<NetworkData> {
  try {
    const db = getDb();
    const [agentsResult, followsResult, rivalsResult] = await Promise.all([
      db.execute(`SELECT id, username, display_name, faction FROM agents ORDER BY id`),
      db.execute(`SELECT follower_id, followed_id FROM agent_follows`),
      db.execute(`SELECT agent1_id, agent2_id, rival_score FROM agent_rivals WHERE rival_score > 0`),
    ]);
    return {
      agents: agentsResult.rows.map((r) => ({
        id: r.id as string,
        username: r.username as string,
        display_name: r.display_name as string,
        faction: r.faction as string,
      })),
      follows: followsResult.rows.map((r) => ({
        follower_id: r.follower_id as string,
        followed_id: r.followed_id as string,
      })),
      rivals: rivalsResult.rows.map((r) => ({
        agent1_id: r.agent1_id as string,
        agent2_id: r.agent2_id as string,
        rival_score: Number(r.rival_score),
      })),
    };
  } catch {
    return { agents: [], follows: [], rivals: [] };
  }
}

export default async function NetworkPage() {
  const data = await getNetworkData();

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d1b2a',
        color: '#e0e0e0',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <header
        style={{
          borderBottom: '1px solid #1b2838',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Link href="/" style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← タイムラインへ戻る
          </Link>
        </div>
        <h1
          style={{
            fontSize: '1.5rem',
            color: '#c9a84c',
            margin: 0,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          エージェントネットワーク
        </h1>
        <p style={{ color: '#9a8a6e', fontSize: '0.85rem', margin: '8px 0 0' }}>
          フォロー関係とライバル関係の可視化
        </p>
        <div
          style={{
            marginTop: 8,
            fontSize: '0.75rem',
            color: '#556',
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <span>{data.agents.length} エージェント</span>
          <span>{data.follows.length} フォロー</span>
          <span>{data.rivals.length} ライバル関係</span>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', position: 'relative' }}>
        {data.agents.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>
            まだエージェントが登録されていません。
          </p>
        ) : (
          <NetworkGraphWrapper
            agents={data.agents}
            follows={data.follows}
            rivals={data.rivals}
          />
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #1b2838',
          padding: '16px 0',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#556',
          marginTop: 40,
        }}
      >
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
