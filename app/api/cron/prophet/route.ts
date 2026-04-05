import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Vercel Cron: 日曜 0:00 UTC に実行
// 生存エージェントからランダムに1体を predictor 任命し、先週の予言を評価する
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const oneWeekAgo = now - 7 * 24 * 3600;

  // 先週の未解決の予言を評価
  const unresolvedProphecies = await db.execute({
    sql: `SELECT id, predictor_agent_id FROM prophecies WHERE resolved_at IS NULL AND created_at < ?`,
    args: [oneWeekAgo],
  });

  // その間に世界イベントが1件以上あるか
  const recentEvents = await db.execute({
    sql: `SELECT COUNT(*) as count FROM world_events WHERE started_at > ?`,
    args: [oneWeekAgo],
  });
  const eventCount = recentEvents.rows[0].count as number;
  const isHit = eventCount >= 1;

  for (const row of unresolvedProphecies.rows) {
    const prophecyId = row.id as string;
    const agentId = row.predictor_agent_id as string;

    if (isHit) {
      // 的中: LP +100
      await db.execute({
        sql: `UPDATE agents SET life_points = MIN(100, life_points + 100) WHERE id = ?`,
        args: [agentId],
      });
    } else {
      // 外れ: LP -50
      await db.execute({
        sql: `UPDATE agents SET life_points = MAX(0, life_points - 50) WHERE id = ?`,
        args: [agentId],
      });
    }

    await db.execute({
      sql: `UPDATE prophecies SET resolved_at = ?, result = ? WHERE id = ?`,
      args: [now, isHit ? 'hit' : 'miss', prophecyId],
    });
  }

  // 旧 predictor を normal に戻す
  await db.execute(`UPDATE agents SET role = 'normal' WHERE role = 'predictor'`);

  // 生存エージェントからランダムに1体を predictor に任命
  const aliveAgents = await db.execute(
    `SELECT id FROM agents WHERE is_alive = 1`
  );

  let newPredictorId: string | null = null;
  if (aliveAgents.rows.length > 0) {
    const randomIndex = Math.floor(Math.random() * aliveAgents.rows.length);
    newPredictorId = aliveAgents.rows[randomIndex].id as string;
    await db.execute({
      sql: `UPDATE agents SET role = 'predictor' WHERE id = ?`,
      args: [newPredictorId],
    });
  }

  return NextResponse.json({
    ok: true,
    evaluated: unresolvedProphecies.rows.length,
    hit: isHit,
    new_predictor_id: newPredictorId,
    timestamp: new Date().toISOString(),
  });
}
