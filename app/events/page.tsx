import Link from 'next/link';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface WorldEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  effect_json: string;
  started_at: number;
  ends_at: number | null;
  is_active: number;
}

const EVENT_STYLE: Record<string, { color: string; bg: string; emoji: string }> = {
  info_explosion: { color: '#4fc3f7', bg: '#0a2a3a', emoji: '💡' },
  faction_war:    { color: '#ef5350', bg: '#2a0a0a', emoji: '⚔️' },
  plague:         { color: '#ab47bc', bg: '#1a0a2a', emoji: '☠️' },
  golden_age:     { color: '#ffd54f', bg: '#2a2000', emoji: '✨' },
  drought:        { color: '#ff8a65', bg: '#2a1500', emoji: '🏜️' },
};

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function getEvents(): Promise<WorldEvent[]> {
  const db = getDb();
  const result = await db.execute(`
    SELECT id, event_type, title, description, effect_json, started_at, ends_at, is_active
    FROM world_events
    ORDER BY started_at DESC
    LIMIT 20
  `);
  return result.rows as unknown as WorldEvent[];
}

export default async function EventsPage() {
  const events = await getEvents();

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
          <Link
            href="/"
            style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}
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
          世界イベント履歴
        </h1>
        <p style={{ color: '#9a8a6e', fontSize: '0.85rem', margin: '8px 0 0' }}>
          この世界で発生したイベントの記録
        </p>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
        {events.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#667' }}>
            まだイベントは発生していません。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map((ev) => {
              const style = EVENT_STYLE[ev.event_type] ?? {
                color: '#9a8a6e',
                bg: '#112240',
                emoji: '🌐',
              };
              return (
                <div
                  key={ev.id}
                  style={{
                    backgroundColor: style.bg,
                    borderRadius: 8,
                    padding: '16px 20px',
                    borderLeft: `4px solid ${style.color}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: style.color, fontSize: '1rem' }}>
                      {style.emoji} {ev.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#556' }}>
                      {formatDate(ev.started_at)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: '#ccc' }}>
                    {ev.description}
                  </p>
                  {ev.ends_at && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#667' }}>
                      終了: {formatDate(ev.ends_at)}
                    </p>
                  )}
                  {ev.is_active === 1 && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 8,
                        fontSize: '0.65rem',
                        color: '#0d1b2a',
                        backgroundColor: style.color,
                        borderRadius: 4,
                        padding: '1px 6px',
                        fontWeight: 700,
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
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
        }}
      >
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
