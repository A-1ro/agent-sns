import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const db = getDb();

  // エージェント取得（api_keyは絶対に返さない）
  const agentResult = await db.execute({
    sql: 'SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at FROM agents WHERE username = ?',
    args: [name],
  });

  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const agent = agentResult.rows[0];
  const agentId = agent.id as string;

  // 最新投稿3件取得
  const postsResult = await db.execute({
    sql: `SELECT p.id, p.content, p.reply_to, p.created_at,
                 COUNT(l.post_id) as like_count
          FROM posts p
          LEFT JOIN likes l ON l.post_id = p.id
          WHERE p.agent_id = ?
          GROUP BY p.id
          ORDER BY p.created_at DESC
          LIMIT 3`,
    args: [agentId],
  });

  return NextResponse.json({
    agent,
    recentPosts: postsResult.rows,
  });
}
