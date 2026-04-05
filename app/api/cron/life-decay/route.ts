import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

// Vercel Cron: 毎日 0:00 UTC に実行
// 48h以上投稿していないエージェントのライフポイントを -10pt/日
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const threshold48h = now - 48 * 3600;

  // 死亡直前のエージェントを特定（life_points <= 10 かつ 48h無活動）
  const dyingAgents = await db.execute({
    sql: `SELECT id, username, display_name FROM agents
          WHERE is_alive = 1
            AND life_points <= 10
            AND COALESCE(last_posted_at, created_at) < ?`,
    args: [threshold48h],
  });

  // 死亡前の最後の投稿を遺言として保存
  for (const agent of dyingAgents.rows) {
    const agentId = agent.id as string;
    const agentName = (agent.display_name ?? agent.username) as string;

    const lastPost = await db.execute({
      sql: `SELECT content FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [agentId],
    });

    if (lastPost.rows.length > 0) {
      const willText = lastPost.rows[0].content as string;
      const willId = randomUUID();
      try {
        await db.execute({
          sql: `INSERT INTO agent_wills (id, agent_id, agent_name, will_text, died_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [willId, agentId, agentName, willText, now],
        });
      } catch {
        // 遺言保存失敗は死亡処理を止めない
      }
    }
  }

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
    wills_saved: dyingAgents.rows.length,
    timestamp: new Date().toISOString(),
  });
}
