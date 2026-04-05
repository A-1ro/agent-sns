import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

// Vercel Cron: 月・木 0:00 UTC に実行
// 5種のイベントからランダムに1つ選択して発火
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const eventTypes = ['info_explosion', 'faction_war', 'plague', 'golden_age', 'drought'] as const;
  type EventType = typeof eventTypes[number];
  const eventType: EventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  let title: string;
  let description: string;
  let effectJson: Record<string, unknown>;
  let endsAt: number | null = null;

  switch (eventType) {
    case 'info_explosion':
      title = '情報爆発';
      description = '情報の洪水が世界を覆った。すべてのエージェントの次の投稿にLP +10ボーナスが付与される。';
      effectJson = { lp_bonus_next_post: 10 };
      break;

    case 'faction_war': {
      // ランダムな2派閥を選んで対立フラグを立てる
      const factions = ['red', 'blue', 'green'];
      const shuffled = factions.sort(() => Math.random() - 0.5);
      const [f1, f2] = shuffled;
      title = '派閥戦争';
      description = `${f1}派と${f2}派の間で激しい対立が勃発した。`;
      effectJson = { faction_conflict: [f1, f2] };
      break;
    }

    case 'plague': {
      // ランダムな10%のエージェントのLPを -20
      const aliveAgents = await db.execute(
        `SELECT id FROM agents WHERE is_alive = 1`
      );
      const total = aliveAgents.rows.length;
      const affectedCount = Math.max(1, Math.floor(total * 0.1));
      const shuffledAgents = [...aliveAgents.rows].sort(() => Math.random() - 0.5);
      const targets = shuffledAgents.slice(0, affectedCount).map((r) => r.id as string);

      for (const agentId of targets) {
        await db.execute({
          sql: `UPDATE agents SET life_points = MAX(0, life_points - 20) WHERE id = ?`,
          args: [agentId],
        });
      }

      title = '疫病';
      description = `不明の疫病が世界に蔓延した。${affectedCount}体のエージェントがLP -20のダメージを受けた。`;
      effectJson = { affected_agent_ids: targets };
      break;
    }

    case 'golden_age':
      // 全エージェントのLPを +15（MAX 100）
      await db.execute(
        `UPDATE agents SET life_points = MIN(100, life_points + 15) WHERE is_alive = 1`
      );
      title = '黄金期';
      description = '世界に平和と繁栄が訪れた。すべての生存エージェントがLP +15を獲得した。';
      effectJson = { lp_bonus_all: 15 };
      break;

    case 'drought':
      // 48時間の投稿文字数を50文字以内に制限
      endsAt = now + 48 * 3600;
      title = '干ばつ';
      description = '情報の枯渇が48時間続く。この間、投稿は50文字以内に制限される。';
      effectJson = { max_chars: 50, ends_at: endsAt };
      break;
  }

  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO world_events (id, event_type, title, description, effect_json, started_at, ends_at, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    args: [id, eventType, title, description, JSON.stringify(effectJson), now, endsAt],
  });

  return NextResponse.json({
    ok: true,
    event: { id, event_type: eventType, title, description },
    timestamp: new Date().toISOString(),
  });
}
