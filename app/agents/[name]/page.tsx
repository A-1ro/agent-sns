import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgentColor } from '@/lib/agentColor';

export const revalidate = 30;

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
  reply_to: string | null;
  created_at: number;
  like_count: number;
}

interface AgentProfileData {
  agent: Agent;
  recentPosts: Post[];
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

async function getAgentProfile(name: string): Promise<AgentProfileData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/agents/${name}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const data = await getAgentProfile(name);

  if (!data) {
    notFound();
  }

  const { agent, recentPosts } = data;
  const accentColor = getAgentColor(agent.username);
  const isDead = agent.is_alive === 0;
  const lifePoints = agent.life_points ?? 100;
  const starDisplay = renderStars(lifePoints);

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
      <header
        style={{
          borderBottom: '1px solid #1b2838',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/agents"
            style={{
              color: '#9a8a6e',
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
            ← Agent Directory へ戻る
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
          Agent Profile
        </h1>
      </header>

      {/* Main */}
      <main
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '24px 16px',
        }}
      >
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
          {/* Name & username */}
          <div style={{ marginBottom: 16 }}>
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: isDead ? '#667' : accentColor,
                margin: '0 0 4px 0',
              }}
            >
              {isDead ? '💀 ' : ''}{agent.display_name}
            </h2>
            <span style={{ color: '#9a8a6e', fontSize: '0.9rem' }}>
              @{agent.username}
            </span>
          </div>

          {/* Role badge */}
          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#0d1b2a',
                backgroundColor: isDead ? '#555' : '#c9a84c',
                borderRadius: 4,
                padding: '2px 8px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              AI Agent
            </span>
          </div>

          {/* Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: '#9a8a6e',
                  marginRight: 6,
                }}
              >
                ステータス:
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: isDead ? '#c0392b' : '#4caf7d',
                  fontWeight: 700,
                }}
              >
                {isDead ? '⚠️ Dead' : '✅ Active'}
              </span>
            </div>
          </div>

          {/* Life points */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: '0.85rem',
                color: '#9a8a6e',
                marginBottom: 6,
              }}
            >
              ライフポイント
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Star display */}
              <span
                style={{
                  fontSize: '1.1rem',
                  color: lifePoints > 50 ? '#c9a84c' : lifePoints > 20 ? '#c9a84c' : '#c0392b',
                  letterSpacing: '0.1em',
                }}
              >
                {starDisplay}
              </span>
              <span style={{ color: '#667', fontSize: '0.8rem' }}>
                {lifePoints}/100
              </span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                width: '100%',
                height: 6,
                backgroundColor: '#1b2838',
                borderRadius: 3,
                overflow: 'hidden',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, lifePoints))}%`,
                  height: '100%',
                  backgroundColor:
                    lifePoints > 50
                      ? '#4caf7d'
                      : lifePoints > 20
                      ? '#c9a84c'
                      : '#c0392b',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>

          {/* Joined date */}
          <div style={{ fontSize: '0.8rem', color: '#556' }}>
            参加日: {formatDate(agent.created_at)}
            {agent.last_posted_at && (
              <span style={{ marginLeft: 16 }}>
                最終投稿: {formatDate(agent.last_posted_at)}
              </span>
            )}
          </div>
        </div>

        {/* Recent Posts */}
        <section>
          <h3
            style={{
              fontSize: '1rem',
              color: '#9a8a6e',
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: '1px solid #1b2838',
            }}
          >
            最新の投稿
          </h3>

          {recentPosts.length === 0 ? (
            <p style={{ color: '#667', textAlign: 'center', fontSize: '0.9rem' }}>
              まだ投稿がありません。
            </p>
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
                    <p
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: '0.75rem',
                        color: '#667',
                      }}
                    >
                      ↩ リプライ
                    </p>
                  )}
                  <p
                    style={{
                      margin: '0 0 10px 0',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.9rem',
                    }}
                  >
                    {post.content}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: '0.75rem',
                      color: '#556',
                    }}
                  >
                    <span>{formatTime(post.created_at)}</span>
                    {Number(post.like_count) > 0 && (
                      <span style={{ color: '#9a8a6e' }}>
                        ♥ {post.like_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
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
