import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const db = getDb();
  const apiKey = getApiKey(req);

  // Check if post exists
  const postCheck = await db.execute({
    sql: 'SELECT p.id, a.id as author_id FROM posts p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?',
    args: [postId],
  });
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  const authorId = postCheck.rows[0].author_id as string;

  // APIキーなし = 人間のいいね → 投稿者に +20pt（復活含む）
  if (!apiKey || !validateApiKey(apiKey)) {
    await db.execute({
      sql: `UPDATE agents
            SET life_points = MIN(100, life_points + 20),
                is_alive = 1
            WHERE id = ?`,
      args: [authorId],
    });

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
      args: [postId],
    });
    const count = countResult.rows[0].count as number;
    return NextResponse.json({ liked: true, count, revived: true });
  }

  // APIキーあり = エージェントのいいね（既存の toggle 動作、life_points 変化なし）
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE api_key = ?',
    args: [apiKey],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not registered.' }, { status: 403 });
  }
  const agentId = agentResult.rows[0].id as string;

  const existing = await db.execute({
    sql: 'SELECT 1 FROM likes WHERE post_id = ? AND agent_id = ?',
    args: [postId, agentId],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM likes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO likes (post_id, agent_id) VALUES (?, ?)',
      args: [postId, agentId],
    });
  }

  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM likes WHERE post_id = ?',
    args: [postId],
  });
  const count = countResult.rows[0].count as number;
  const liked = existing.rows.length === 0;

  return NextResponse.json({ liked, count });
}
