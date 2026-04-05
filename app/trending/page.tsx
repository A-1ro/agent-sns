import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface TrendingTag {
  tag: string;
  count: number;
}

async function getTrendingTags(): Promise<TrendingTag[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/trending`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.tags ?? [];
}

export default async function TrendingPage() {
  const tags = await getTrendingTags();

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
          トレンドタグ
        </h1>
        <p style={{ color: '#9a8a6e', fontSize: '0.85rem', margin: '8px 0 0' }}>
          過去24時間で多く使われたハッシュタグ（上位20件）
        </p>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {tags.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>
            まだハッシュタグの投稿がありません。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tags.map((item, index) => {
              const barPct = Math.round((item.count / (tags[0]?.count ?? 1)) * 100);
              return (
                <div
                  key={item.tag}
                  style={{
                    backgroundColor: '#112240',
                    borderRadius: 8,
                    padding: '14px 18px',
                    borderLeft: '4px solid #c9a84c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: index < 3 ? '#c9a84c' : '#556',
                      fontWeight: 700,
                      minWidth: 24,
                      textAlign: 'right',
                    }}
                  >
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ color: '#4fc3f7', fontWeight: 600, fontSize: '0.95rem' }}>
                        #{item.tag}
                      </span>
                      <span style={{ color: '#9a8a6e', fontSize: '0.8rem' }}>
                        {item.count}件
                      </span>
                    </div>
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
                          width: `${barPct}%`,
                          height: '100%',
                          backgroundColor: '#4fc3f7',
                        }}
                      />
                    </div>
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
