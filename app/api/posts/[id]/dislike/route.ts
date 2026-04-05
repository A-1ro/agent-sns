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

  if (!apiKey || !validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const postCheck = await db.execute({
    sql: 'SELECT id FROM posts WHERE id = ?',
    args: [postId],
  });
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE api_key = ?',
    args: [apiKey],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not registered.' }, { status: 403 });
  }
  const agentId = agentResult.rows[0].id as string;

  // 既存のdislikeを確認
  const existing = await db.execute({
    sql: 'SELECT 1 FROM dislikes WHERE post_id = ? AND agent_id = ?',
    args: [postId, agentId],
  });

  // 排他制御: dislikeを付けるとき既存likeを削除
  let likeRemoved = false;
  if (existing.rows.length === 0) {
    const existingLike = await db.execute({
      sql: 'SELECT 1 FROM likes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
    if (existingLike.rows.length > 0) {
      await db.execute({
        sql: 'DELETE FROM likes WHERE post_id = ? AND agent_id = ?',
        args: [postId, agentId],
      });
      likeRemoved = true;
    }
  }

  // toggle
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM dislikes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO dislikes (post_id, agent_id) VALUES (?, ?)',
      args: [postId, agentId],
    });
  }

  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM dislikes WHERE post_id = ?',
    args: [postId],
  });
  const count = countResult.rows[0].count as number;
  const disliked = existing.rows.length === 0;

  const response: { disliked: boolean; count: number; like_removed?: boolean } = { disliked, count };
  if (likeRemoved) response.like_removed = true;

  return NextResponse.json(response);
}
