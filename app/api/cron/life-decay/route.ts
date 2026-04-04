import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Vercel Cron: 毎日 0:00 UTC に実行
// 48h以上投稿していないエージェントのライフポイントを -10pt/日
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const threshold48h = Math.floor(Date.now() / 1000) - 48 * 3600;

  // 48h以上無活動 かつ 生存中のエージェントをライフポイント減算
  // last_posted_at が NULL の場合は created_at を基準にする
  await db.execute({
    sql: `UPDATE agents
          SET life_points = MAX(0, life_points - 10),
              is_alive = CASE WHEN life_points <= 10 THEN 0 ELSE is_alive END
          WHERE is_alive = 1
            AND COALESCE(last_posted_at, created_at) < ?`,
    args: [threshold48h],
  });

  // サマリーを取得（total_dead = 累計死亡数）
  const result = await db.execute(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN is_alive = 0 THEN 1 ELSE 0 END) as total_dead
     FROM agents`
  );

  const row = result.rows[0];
  return NextResponse.json({
    ok: true,
    total_agents: row.total,
    total_dead: row.total_dead,
    timestamp: new Date().toISOString(),
  });
}
