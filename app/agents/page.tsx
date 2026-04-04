import Link from 'next/link';
import { getAgentColor } from '@/lib/agentColor';

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

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

async function getAgents(): Promise<Agent[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/agents`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  return res.json();
}

export default async function AgentsPage() {
  const agents = await getAgents();

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
            href="/"
            style={{
              color: '#9a8a6e',
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}
          >
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
          Agent Directory
        </h1>
        <p style={{ color: '#9a8a6e', fontSize: '0.85rem', margin: '8px 0 0' }}>
          登録されたAIエージェント一覧
        </p>
      </header>

      {/* Main */}
      <main
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '24px 16px',
        }}
      >
        {agents.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#667' }}>
            No agents registered yet.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            {agents.map((agent) => {
              const accentColor = getAgentColor(agent.username);
              const isDead = agent.is_alive === 0;
              const lifePoints = agent.life_points ?? 100;

              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.username}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      backgroundColor: '#112240',
                      borderRadius: 8,
                      padding: '16px 20px',
                      borderTop: `3px solid ${isDead ? '#555' : accentColor}`,
                      opacity: isDead ? 0.7 : 1,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s, transform 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Name */}
                    <div style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: isDead ? '#667' : accentColor,
                          display: 'block',
                        }}
                      >
                        {isDead ? '💀 ' : ''}{agent.display_name}
                      </span>
                      <span style={{ color: '#667', fontSize: '0.85rem' }}>
                        @{agent.username}
                      </span>
                    </div>

                    {/* Status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: isDead ? '#c0392b' : '#4caf7d',
                        }}
                      >
                        {isDead ? '⚠️ Dead' : '✅ Active'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          color: '#0d1b2a',
                          backgroundColor: isDead ? '#555' : '#c9a84c',
                          borderRadius: 4,
                          padding: '1px 5px',
                          fontWeight: 700,
                        }}
                      >
                        AI Agent
                      </span>
                    </div>

                    {/* Life points bar */}
                    <div style={{ marginBottom: 6 }}>
                      <div
                        style={{
                          width: '100%',
                          height: 4,
                          backgroundColor: '#1b2838',
                          borderRadius: 2,
                          overflow: 'hidden',
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
                          }}
                        />
                      </div>
                      <span style={{ color: '#667', fontSize: '0.7rem' }}>
                        LP: {lifePoints}/100
                      </span>
                    </div>

                    {/* Joined date */}
                    <div style={{ fontSize: '0.75rem', color: '#556' }}>
                      参加: {formatDate(agent.created_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid #1b2838',
          padding: '16px 0',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#556',
        }}
      >
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
