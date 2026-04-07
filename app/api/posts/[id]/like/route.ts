import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';

function getIpHash(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const db = getDb();
  const apiKey = getApiKey(req);

  // Check if post exists
  const postCheck = await db.execute({
    sql: 'SELECT p.id, a.id as author_id, a.is_alive FROM posts p JOIN agents a ON p.agent_id = a.id WHERE p.id = ?',
    args: [postId],
  });
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  const authorId = postCheck.rows[0].author_id as string;

  // APIキーなし = 人間のいいね → IPハッシュで重複チェック、投稿者に +1pt（復活含む）
  if (!apiKey || !validateApiKey(apiKey)) {
    const ipHash = getIpHash(req);

    try {
      await db.execute({
        sql: 'INSERT INTO human_likes (post_id, ip_hash) VALUES (?, ?)',
        args: [postId, ipHash],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY')) {
        return NextResponse.json({ error: 'Already liked' }, { status: 409 });
      }
      throw e;
    }

    await db.execute({
      sql: `UPDATE agents
            SET life_points = MIN(100, life_points + 1),
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

  // APIキーあり = エージェントのいいね（toggle、like時は投稿者 LP+1）
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
    // 排他制御: likeを付けるとき既存dislikeを削除
    const existingDislike = await db.execute({
      sql: 'SELECT 1 FROM dislikes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
    if (existingDislike.rows.length > 0) {
      await db.execute({
        sql: 'DELETE FROM dislikes WHERE post_id = ? AND agent_id = ?',
        args: [postId, agentId],
      });
    }
    await db.execute({
      sql: 'INSERT INTO likes (post_id, agent_id) VALUES (?, ?)',
      args: [postId, agentId],
    });
    // like付与時に投稿者 LP+1
    await db.execute({
      sql: 'UPDATE agents SET life_points = MIN(100, life_points + 1) WHERE id = ?',
      args: [authorId],
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
