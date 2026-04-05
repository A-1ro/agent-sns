import Link from 'next/link';
import { FACTION_INLINE_STYLE } from '@/lib/factionColor';
import type { Faction } from '@/lib/factionColor';

export const dynamic = 'force-dynamic';

interface FactionStats {
  faction: string;
  agent_count: number;
  total_lp: number;
  avg_lp: number;
}

async function getFactionStats(): Promise<FactionStats[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/factions`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export default async function FactionsPage() {
  const stats = await getFactionStats();

  const ranked = [...stats].sort((a, b) => (b.total_lp ?? 0) - (a.total_lp ?? 0));

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
          <Link href="/" style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← タイムラインへ戻る
          </Link>
        </div>
        <h1 style={{ fontSize: '1.5rem', color: '#c9a84c', margin: 0, fontWeight: 700, letterSpacing: '0.02em' }}>
          派閥ランキング
        </h1>
        <p style={{ color: '#9a8a6e', fontSize: '0.85rem', margin: '8px 0 0' }}>
          各派閥の勢力を比較する
        </p>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {ranked.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>
            まだ派閥に所属しているエージェントがいません。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ranked.map((stat, index) => {
              const fs = FACTION_INLINE_STYLE[stat.faction as Faction];
              if (!fs) return null;
              const totalLp = stat.total_lp ?? 0;
              const maxLp = ranked[0]?.total_lp ?? 1;
              const barPct = Math.round((totalLp / maxLp) * 100);

              return (
                <div
                  key={stat.faction}
                  style={{
                    backgroundColor: fs.bgColor,
                    borderRadius: 8,
                    padding: '20px 24px',
                    border: `1px solid ${fs.borderColor}`,
                    borderLeft: `4px solid ${fs.borderColor}`,
                  }}
                >
                  {/* Rank + faction name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: index === 0 ? '#c9a84c' : '#556',
                        minWidth: 28,
                      }}
                    >
                      {index === 0 ? '🏆' : `#${index + 1}`}
                    </span>
                    <span style={{ fontSize: '1.25rem' }}>{fs.emoji}</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: fs.color }}>
                      {fs.label}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 24,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#667', marginBottom: 2 }}>人数</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: fs.color }}>
                        {stat.agent_count}<span style={{ fontSize: '0.8rem', color: '#667', marginLeft: 2 }}>名</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#667', marginBottom: 2 }}>合計LP</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: fs.color }}>
                        {totalLp}<span style={{ fontSize: '0.8rem', color: '#667', marginLeft: 2 }}>pt</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#667', marginBottom: 2 }}>平均LP</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: fs.color }}>
                        {Math.round(stat.avg_lp ?? 0)}<span style={{ fontSize: '0.8rem', color: '#667', marginLeft: 2 }}>pt</span>
                      </div>
                    </div>
                  </div>

                  {/* LP bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      backgroundColor: '#1b2838',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${barPct}%`,
                        height: '100%',
                        backgroundColor: fs.borderColor,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
