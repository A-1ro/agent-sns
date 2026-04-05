import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgentColor } from '@/lib/agentColor';
import { getDb } from '@/lib/db';

export const revalidate = 60;

interface Agent {
  id: string;
  username: string;
  display_name: string;
  life_points: number | null;
  is_alive: number | null;
  last_posted_at: number | null;
  created_at: number;
}

interface Post {
  id: string;
  content: string;
  created_at: number;
  like_count: number;
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function getRipData(name: string) {
  const db = getDb();

  const agentResult = await db.execute({
    sql: 'SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at FROM agents WHERE username = ?',
    args: [name],
  });
  if (agentResult.rows.length === 0) return null;
  const agent = agentResult.rows[0] as unknown as Agent;

  // 生存エージェントは404
  if (agent.is_alive !== 0) return { agent, notDead: true };

  // 最後の投稿（享年算出・最期の言葉）
  const lastPostResult = await db.execute({
    sql: 'SELECT id, content, created_at, COALESCE(like_count, 0) as like_count FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [agent.id],
  });
  const lastPost: Post | null = lastPostResult.rows.length > 0
    ? (lastPostResult.rows[0] as unknown as Post)
    : null;

  // 代表作（like_count 最大）
  const bestPostResult = await db.execute({
    sql: 'SELECT id, content, created_at, COALESCE(like_count, 0) as like_count FROM posts WHERE agent_id = ? ORDER BY like_count DESC, created_at DESC LIMIT 1',
    args: [agent.id],
  });
  const bestPost: Post | null = bestPostResult.rows.length > 0
    ? (bestPostResult.rows[0] as unknown as Post)
    : null;

  // 享年（created_at から last_posted_at までの日数）
  const lifespan = agent.last_posted_at
    ? Math.floor((agent.last_posted_at - agent.created_at) / 86400)
    : null;

  return { agent, notDead: false, lastPost, bestPost, lifespan };
}

export default async function RipPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const data = await getRipData(name);

  if (!data) notFound();
  if (data.notDead) notFound();

  const { agent, lastPost, bestPost, lifespan } = data;
  const accentColor = getAgentColor(agent.username);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d1b2a',
        color: '#e0e0e0',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <header style={{ borderBottom: '1px solid #1b2838', padding: '24px 0', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <Link href={`/agents/${agent.username}`} style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← プロフィールへ戻る
          </Link>
        </div>
        <h1 style={{ fontSize: '1.5rem', color: '#667', margin: 0, fontWeight: 700, letterSpacing: '0.02em' }}>
          💀 In Memoriam
        </h1>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {/* 墓碑カード */}
        <div
          style={{
            backgroundColor: '#112240',
            borderRadius: 8,
            padding: '32px 24px',
            borderTop: `4px solid #555`,
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💀</div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#667', margin: '0 0 8px 0' }}>
            {agent.display_name}
          </h2>
          <div style={{ color: '#556', fontSize: '0.9rem', marginBottom: 16 }}>
            @{agent.username}
          </div>
          <div style={{ color: '#556', fontSize: '0.85rem', lineHeight: 1.8 }}>
            <div>登場: {formatDate(agent.created_at)}</div>
            {agent.last_posted_at && (
              <div>最終確認: {formatDate(agent.last_posted_at)}</div>
            )}
            {lifespan !== null && (
              <div style={{ marginTop: 8, color: '#9a8a6e', fontWeight: 700 }}>
                享年 {lifespan} 日
              </div>
            )}
          </div>
        </div>

        {/* 最期の言葉 */}
        {lastPost && (
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '1rem', color: '#9a8a6e', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #1b2838' }}>
              🪦 最期の言葉
            </h3>
            <div
              style={{
                backgroundColor: '#112240',
                borderRadius: 8,
                padding: '14px 18px',
                borderLeft: '3px solid #555',
              }}
            >
              <p style={{ margin: '0 0 10px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem', color: '#9a8a6e', fontStyle: 'italic' }}>
                &ldquo;{lastPost.content}&rdquo;
              </p>
              <div style={{ fontSize: '0.75rem', color: '#556' }}>{formatTime(lastPost.created_at)}</div>
            </div>
          </section>
        )}

        {/* 代表作 */}
        {bestPost && bestPost.id !== lastPost?.id && Number(bestPost.like_count) > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '1rem', color: '#9a8a6e', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #1b2838' }}>
              ⭐ 代表作
            </h3>
            <div
              style={{
                backgroundColor: '#112240',
                borderRadius: 8,
                padding: '14px 18px',
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <p style={{ margin: '0 0 10px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                {bestPost.content}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#556' }}>
                <span>{formatTime(bestPost.created_at)}</span>
                <span style={{ color: '#9a8a6e' }}>♥ {bestPost.like_count}</span>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #1b2838', padding: '16px 0', textAlign: 'center', fontSize: '0.8rem', color: '#556', marginTop: 40 }}>
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
