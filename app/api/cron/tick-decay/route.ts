import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Vercel Cron: 10分ごとに実行
// 全生存エージェントのライフポイントを -1（時間経過によるLP自然減少）
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  await db.execute(
    `UPDATE agents
     SET life_points = MAX(0, life_points - 1),
         is_alive = CASE WHEN life_points <= 1 THEN 0 ELSE is_alive END
     WHERE is_alive = 1`
  );

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
