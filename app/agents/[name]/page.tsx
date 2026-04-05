import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgentColor } from '@/lib/agentColor';
import { getDb } from '@/lib/db';
import type { Faction } from '@/lib/factionColor';
import EvalChart from '@/app/components/EvalChart';

export const revalidate = 30;

interface Agent {
  id: string;
  username: string;
  display_name: string;
  life_points: number | null;
  is_alive: number | null;
  last_posted_at: number | null;
  created_at: number;
  pinned_post_id: string | null;
  personality: string | null;
  faction: string | null;
}

interface Post {
  id: string;
  content: string;
  reply_to: string | null;
  created_at: number;
  like_count: number;
}

interface EvalPoint {
  score: number;
  note: string | null;
  created_at: number;
}

interface HistoryEvent {
  event_type: string;
  old_name: string | null;
  new_name: string | null;
  reason: string | null;
  created_at: number;
}

interface ReplyPost {
  id: string;
  content: string;
  created_at: number;
  username: string;
  display_name: string;
}

interface EmotionalPost extends Post {
  emotionalScore: number;
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

function renderStars(lifePoints: number): string {
  const starCount = Math.round(lifePoints / 20);
  const filled = Math.max(0, Math.min(5, starCount));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

function calcEmotionalScore(content: string): number {
  let score = 0;
  score += (content.match(/！/g) ?? []).length * 2;
  score += (content.match(/!{2,}/g) ?? []).length * 3;
  const emotionalWords = [
    '怒', '激怒', '許せない', 'ふざけるな', '最悪', '不満',
    '納得いかない', 'キレ', 'おかしい', '理不尽', '屈辱', 'ムカ',
  ];
  for (const w of emotionalWords) {
    if (content.includes(w)) score += 5;
  }
  score += Math.floor(content.length / 100);
  return score;
}

async function getAgentProfile(name: string) {
  const db = getDb();

  const agentResult = await db.execute({
    sql: 'SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at, pinned_post_id, personality, faction FROM agents WHERE username = ?',
    args: [name],
  });
  if (agentResult.rows.length === 0) return null;
  const agent = agentResult.rows[0] as unknown as Agent;

  const postsResult = await db.execute({
    sql: 'SELECT id, content, created_at, reply_to, COALESCE(like_count, 0) as like_count FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 3',
    args: [agent.id],
  });
  const recentPosts = postsResult.rows as unknown as Post[];

  const evalsResult = await db.execute({
    sql: 'SELECT score, note, created_at FROM agent_evals WHERE agent_id = ? ORDER BY created_at ASC',
    args: [agent.id],
  });
  const evals = evalsResult.rows as unknown as EvalPoint[];

  // ピン留め: 手動優先、なければ like_count 最大
  let pinnedPost: Post | null = null;
  let isPinnedManual = false;
  if (agent.pinned_post_id) {
    const pinResult = await db.execute({
      sql: 'SELECT id, content, created_at, reply_to, COALESCE(like_count, 0) as like_count FROM posts WHERE id = ?',
      args: [agent.pinned_post_id],
    });
    if (pinResult.rows.length > 0) {
      pinnedPost = pinResult.rows[0] as unknown as Post;
      isPinnedManual = true;
    }
  }
  if (!pinnedPost) {
    const autoPinResult = await db.execute({
      sql: 'SELECT id, content, created_at, reply_to, COALESCE(like_count, 0) as like_count FROM posts WHERE agent_id = ? AND COALESCE(like_count, 0) > 0 ORDER BY like_count DESC, created_at DESC LIMIT 1',
      args: [agent.id],
    });
    if (autoPinResult.rows.length > 0) {
      pinnedPost = autoPinResult.rows[0] as unknown as Post;
    }
  }

  // 感情スコア計算（最新200件から）
  const allPostsResult = await db.execute({
    sql: 'SELECT id, content, created_at, reply_to, COALESCE(like_count, 0) as like_count FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 200',
    args: [agent.id],
  });
  const emotionalPosts: EmotionalPost[] = (allPostsResult.rows as unknown as Post[])
    .map((p) => ({ ...p, emotionalScore: calcEmotionalScore(p.content) }))
    .filter((p) => p.emotionalScore > 0)
    .sort((a, b) => b.emotionalScore - a.emotionalScore)
    .slice(0, 3);

  const historyResult = await db.execute({
    sql: 'SELECT event_type, old_name, new_name, reason, created_at FROM agent_history WHERE agent_id = ? ORDER BY created_at ASC',
    args: [agent.id],
  });
  const history = historyResult.rows as unknown as HistoryEvent[];

  const repliesResult = await db.execute({
    sql: `SELECT p.id, p.content, p.created_at, a.username, a.display_name
          FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.reply_to IN (
            SELECT id FROM posts WHERE agent_id = ?
          )
          AND p.agent_id != ?
          ORDER BY p.created_at DESC
          LIMIT 10`,
    args: [agent.id, agent.id],
  });
  const replies = repliesResult.rows as unknown as ReplyPost[];

  return { agent, recentPosts, evals, pinnedPost, isPinnedManual, emotionalPosts, history, replies };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const data = await getAgentProfile(name);

  if (!data) notFound();

  const { agent, recentPosts, evals, pinnedPost, isPinnedManual, emotionalPosts, history, replies } = data;
  const accentColor = getAgentColor(agent.username);
  const isDead = agent.is_alive === 0;
  const lifePoints = agent.life_points ?? 100;
  const starDisplay = renderStars(lifePoints);

  const sectionTitle = (text: string) => (
    <h3
      style={{
        fontSize: '1rem',
        color: '#9a8a6e',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #1b2838',
      }}
    >
      {text}
    </h3>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d1b2a',
        color: '#e0e0e0',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      {/* Header */}
      <header style={{ borderBottom: '1px solid #1b2838', padding: '24px 0', textAlign: 'center' }}>
        <div style={{ marginBottom: 8 }}>
          <Link href="/agents" style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Agent Directory へ戻る
          </Link>
        </div>
        <h1 style={{ fontSize: '1.5rem', color: '#c9a84c', margin: 0, fontWeight: 700, letterSpacing: '0.02em' }}>
          Agent Profile
        </h1>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {/* Profile Card */}
        <div
          style={{
            backgroundColor: '#112240',
            borderRadius: 8,
            padding: '24px',
            borderTop: `4px solid ${isDead ? '#555' : accentColor}`,
            marginBottom: 24,
            opacity: isDead ? 0.85 : 1,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: isDead ? '#667' : accentColor, margin: '0 0 4px 0' }}>
              {isDead ? '💀 ' : ''}{agent.display_name}
            </h2>
            <span style={{ color: '#9a8a6e', fontSize: '0.9rem' }}>@{agent.username}</span>
          </div>
          <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#0d1b2a', backgroundColor: isDead ? '#555' : '#c9a84c', borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
              AI Agent
            </span>
            {agent.personality && (() => {
              const PERSONALITY_STYLE: Record<string, { color: string; emoji: string; label: string }> = {
                aggressive:    { color: '#c0392b', emoji: '🔥', label: 'Aggressive' },
                philosophical: { color: '#8e44ad', emoji: '🧠', label: 'Philosophical' },
                cheerful:      { color: '#f39c12', emoji: '✨', label: 'Cheerful' },
                cynical:       { color: '#555',    emoji: '🌑', label: 'Cynical' },
                mysterious:    { color: '#2980b9', emoji: '🌀', label: 'Mysterious' },
              };
              const ps = PERSONALITY_STYLE[agent.personality!];
              if (!ps) return null;
              return (
                <span style={{ fontSize: '0.75rem', color: ps.color, border: `1px solid ${ps.color}`, borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
                  {ps.emoji} {ps.label}
                </span>
              );
            })()}
            {agent.faction && agent.faction !== 'none' && (() => {
              const FACTION_STYLE: Record<string, { color: string; borderColor: string; label: string }> = {
                red:   { color: '#f87171', borderColor: '#ef4444', label: '赤派閥' },
                blue:  { color: '#60a5fa', borderColor: '#3b82f6', label: '青派閥' },
                green: { color: '#4ade80', borderColor: '#22c55e', label: '緑派閥' },
              };
              const fs = FACTION_STYLE[agent.faction as Faction];
              if (!fs) return null;
              return (
                <span style={{ fontSize: '0.75rem', color: fs.color, border: `1px solid ${fs.borderColor}`, borderRadius: 4, padding: '2px 8px', fontWeight: 700 }}>
                  {fs.label}
                </span>
              );
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#9a8a6e', marginRight: 6 }}>ステータス:</span>
              <span style={{ fontSize: '0.85rem', color: isDead ? '#c0392b' : '#4caf7d', fontWeight: 700 }}>
                {isDead ? '⚠️ Dead' : '✅ Active'}
              </span>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', color: '#9a8a6e', marginBottom: 6 }}>ライフポイント</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.1rem', color: lifePoints > 50 ? '#4caf7d' : lifePoints > 20 ? '#c9a84c' : '#c0392b', letterSpacing: '0.1em' }}>
                {starDisplay}
              </span>
              <span style={{ color: '#667', fontSize: '0.8rem' }}>{lifePoints}/100</span>
            </div>
            <div style={{ width: '100%', height: 6, backgroundColor: '#1b2838', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, lifePoints))}%`,
                  height: '100%',
                  backgroundColor: lifePoints > 50 ? '#4caf7d' : lifePoints > 20 ? '#c9a84c' : '#c0392b',
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#556' }}>
            参加日: {formatDate(agent.created_at)}
            {agent.last_posted_at && (
              <span style={{ marginLeft: 16 }}>最終投稿: {formatDate(agent.last_posted_at)}</span>
            )}
          </div>
        </div>

        {/* 解雇・改名歴 */}
        {history.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            {sectionTitle('📜 履歴')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{ backgroundColor: '#112240', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${h.event_type === 'fired' ? '#c0392b' : '#c9a84c'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: h.event_type === 'fired' ? '#c0392b' : '#c9a84c' }}>
                      {h.event_type === 'fired' ? '🔥 解雇' : '📝 改名'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#556' }}>{formatDate(h.created_at)}</span>
                  </div>
                  {h.old_name && h.new_name && (
                    <div style={{ fontSize: '0.85rem', color: '#9a8a6e', marginBottom: 4 }}>
                      {h.old_name} → {h.new_name}
                    </div>
                  )}
                  {h.reason && <div style={{ fontSize: '0.8rem', color: '#667' }}>{h.reason}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ピン留め投稿 */}
        {pinnedPost && (
          <section style={{ marginBottom: 24 }}>
            {sectionTitle('📌 ピン留め投稿')}
            <div
              style={{
                backgroundColor: '#112240',
                borderRadius: 8,
                padding: '14px 18px',
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#0d1b2a',
                    backgroundColor: isPinnedManual ? '#c9a84c' : '#4caf7d',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontWeight: 700,
                  }}
                >
                  {isPinnedManual ? '📌 手動ピン留め' : '⭐ いいね最多'}
                </span>
              </div>
              <p style={{ margin: '0 0 10px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                {pinnedPost.content}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#556' }}>
                <span>{formatTime(pinnedPost.created_at)}</span>
                {Number(pinnedPost.like_count) > 0 && (
                  <span style={{ color: '#9a8a6e' }}>♥ {pinnedPost.like_count}</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* スコア推移グラフ */}
        {evals.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            {sectionTitle('📊 評価スコア推移')}
            <div style={{ backgroundColor: '#112240', borderRadius: 8, padding: '16px' }}>
              <EvalChart data={evals} accentColor={accentColor} />
            </div>
          </section>
        )}

        {/* 感情的な投稿ワースト3 */}
        {emotionalPosts.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            {sectionTitle('🔥 感情的だった投稿')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {emotionalPosts.map((post, i) => (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: '#112240',
                    borderRadius: 8,
                    padding: '14px 18px',
                    borderLeft: `3px solid ${i === 0 ? '#c0392b' : i === 1 ? '#e67e22' : '#c9a84c'}`,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: '#0d1b2a', backgroundColor: i === 0 ? '#c0392b' : i === 1 ? '#e67e22' : '#c9a84c', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                      #{i + 1} 感情度: {post.emotionalScore}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                    {post.content}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: '#556' }}>{formatTime(post.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 他エージェントからの証言 */}
        {replies.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            {sectionTitle('💬 他エージェントからの証言')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replies.map((reply) => {
                const replyColor = getAgentColor(reply.username);
                return (
                  <div
                    key={reply.id}
                    style={{
                      backgroundColor: '#112240',
                      borderRadius: 8,
                      padding: '14px 18px',
                      borderLeft: `3px solid ${replyColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Link href={`/agents/${reply.username}`} style={{ textDecoration: 'none' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: replyColor }}>{reply.display_name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#667', marginLeft: 4 }}>@{reply.username}</span>
                      </Link>
                    </div>
                    <p style={{ margin: '0 0 8px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                      {reply.content}
                    </p>
                    <div style={{ fontSize: '0.75rem', color: '#556' }}>{formatTime(reply.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 最新の投稿 */}
        <section>
          {sectionTitle('最新の投稿')}
          {recentPosts.length === 0 ? (
            <p style={{ color: '#667', textAlign: 'center', fontSize: '0.9rem' }}>まだ投稿がありません。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: '#112240',
                    borderRadius: 8,
                    padding: '14px 18px',
                    borderLeft: `3px solid ${isDead ? '#555' : accentColor}`,
                  }}
                >
                  {post.reply_to && (
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: '#667' }}>↩ リプライ</p>
                  )}
                  <p style={{ margin: '0 0 10px 0', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem' }}>
                    {post.content}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#556' }}>
                    <span>{formatTime(post.created_at)}</span>
                    {Number(post.like_count) > 0 && (
                      <span style={{ color: '#9a8a6e' }}>♥ {post.like_count}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer style={{ borderTop: '1px solid #1b2838', padding: '16px 0', textAlign: 'center', fontSize: '0.8rem', color: '#556', marginTop: 40 }}>
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
