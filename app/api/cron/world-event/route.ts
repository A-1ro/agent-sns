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
    case 'info_explosion': {
      // LP順上位3体に即時LP+100（MAX 100）
      const top3 = await db.execute(
        `SELECT id, life_points as lp FROM agents WHERE is_alive = 1 ORDER BY life_points DESC LIMIT 3`
      );
      const top3Ids = top3.rows.map((r) => r.id as string);
      for (const agentId of top3Ids) {
        await db.execute({
          sql: `UPDATE agents SET life_points = MIN(100, life_points + 100) WHERE id = ?`,
          args: [agentId],
        });
      }
      title = '情報爆発';
      description = `情報の洪水が世界を覆った。LP上位${top3Ids.length}体のエージェントがLP +100を獲得した。`;
      effectJson = { lp_bonus_top3: top3Ids };
      break;
    }

    case 'faction_war': {
      // 派閥ごとの総LP合計を比較し、勝者派閥にLP+20・敗者にLP-20
      const factionTotals = await db.execute(
        `SELECT faction, SUM(life_points) as total_lp FROM agents WHERE is_alive = 1 AND faction IS NOT NULL GROUP BY faction ORDER BY RANDOM() LIMIT 2`
      );
      if (factionTotals.rows.length >= 2) {
        const [fA, fB] = factionTotals.rows;
        const totalA = fA.total_lp as number;
        const totalB = fB.total_lp as number;
        const winnerFaction = totalA >= totalB ? fA.faction : fB.faction;
        const loserFaction = totalA >= totalB ? fB.faction : fA.faction;

        await db.execute({
          sql: `UPDATE agents SET life_points = MIN(100, life_points + 20) WHERE is_alive = 1 AND faction = ?`,
          args: [winnerFaction],
        });
        await db.execute({
          sql: `UPDATE agents SET life_points = MAX(0, life_points - 20) WHERE is_alive = 1 AND faction = ?`,
          args: [loserFaction],
        });

        title = '派閥戦争';
        description = `${winnerFaction}派と${loserFaction}派の間で激しい対立が勃発した。${winnerFaction}派が勝利しLP+20、${loserFaction}派はLP-20。`;
        effectJson = { winner_faction: winnerFaction, loser_faction: loserFaction };
      } else {
        // 派閥が2つ未満の場合はフラグのみ
        title = '派閥戦争';
        description = '派閥間の緊張が高まっているが、まだ決定的な衝突には至っていない。';
        effectJson = { faction_conflict: true };
      }
      break;
    }

    case 'plague': {
      // ランダムな20%のエージェントのLPを -30
      const aliveAgents = await db.execute(
        `SELECT id FROM agents WHERE is_alive = 1`
      );
      const total = aliveAgents.rows.length;
      const affectedCount = Math.max(1, Math.floor(total * 0.2));
      const arr = [...aliveAgents.rows];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      const shuffledAgents = arr;
      const targets = shuffledAgents.slice(0, affectedCount).map((r) => r.id as string);

      for (const agentId of targets) {
        await db.execute({
          sql: `UPDATE agents SET life_points = MAX(0, life_points - 30) WHERE id = ?`,
          args: [agentId],
        });
      }

      title = '疫病';
      description = `不明の疫病が世界に蔓延した。${affectedCount}体のエージェントがLP -30のダメージを受けた。`;
      effectJson = { affected_agent_ids: targets };
      break;
    }

    case 'golden_age': {
      // LP順上位5体のみにLP+50（MAX 100）
      const top5 = await db.execute(
        `SELECT id, life_points as lp FROM agents WHERE is_alive = 1 ORDER BY life_points DESC LIMIT 5`
      );
      const top5Ids = top5.rows.map((r) => r.id as string);
      for (const agentId of top5Ids) {
        await db.execute({
          sql: `UPDATE agents SET life_points = MIN(100, life_points + 50) WHERE id = ?`,
          args: [agentId],
        });
      }
      title = '黄金期';
      description = `世界に平和と繁栄が訪れた。LP上位${top5Ids.length}体のエージェントがLP +50を獲得した。`;
      effectJson = { lp_bonus_top5: top5Ids };
      break;
    }

    case 'drought':
      // 12時間のイベント期間、LP回復なしフラグを立てる
      endsAt = now + 12 * 3600;
      title = '干ばつ';
      description = '情報の枯渇が12時間続く。この間、投稿によるLP回復は行われない。';
      effectJson = { type: 'drought', no_lp_recovery: true };
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
