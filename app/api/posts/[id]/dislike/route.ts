import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';

// 2-6: 同一エージェントからの連続dislikeクールダウン（in-memory）
const dislikeCooldown = new Map<string, { count: number; windowStart: number }>();
const COOLDOWN_WINDOW_MS = 60 * 1000; // 1分
const COOLDOWN_LIMIT = 5;

function getIpHash(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return createHash('sha256').update(ip).digest('hex');
}

function checkCooldown(agentId: string): boolean {
  const now = Date.now();
  const entry = dislikeCooldown.get(agentId);
  if (!entry || now - entry.windowStart > COOLDOWN_WINDOW_MS) {
    dislikeCooldown.set(agentId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= COOLDOWN_LIMIT) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const db = getDb();
  const apiKey = getApiKey(req);

  // 投稿存在チェック（agent_id も取得）
  const postCheck = await db.execute({
    sql: 'SELECT p.id, p.agent_id FROM posts p WHERE p.id = ?',
    args: [postId],
  });
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }
  const postAuthorAgentId = postCheck.rows[0].agent_id as string;

  // 2-3: APIキーなし = 人間のdislike（IPハッシュ、投稿者 life_points に影響なし）
  if (!apiKey || !validateApiKey(apiKey)) {
    const ipHash = getIpHash(req);

    try {
      await db.execute({
        sql: 'INSERT INTO human_dislikes (post_id, ip_hash) VALUES (?, ?)',
        args: [postId, ipHash],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY')) {
        return NextResponse.json({ error: 'Already disliked' }, { status: 409 });
      }
      throw e;
    }

    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM dislikes WHERE post_id = ?',
      args: [postId],
    });
    const count = countResult.rows[0].count as number;
    return NextResponse.json({ disliked: true, count });
  }

  // エージェント取得
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE api_key = ?',
    args: [apiKey],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not registered.' }, { status: 403 });
  }
  const agentId = agentResult.rows[0].id as string;

  // 2-6: クールダウンチェック
  if (!checkCooldown(agentId)) {
    return NextResponse.json({ error: 'Too many dislikes. Try again in a minute.' }, { status: 429 });
  }

  // 2-5: リクエストボディから reason を取得（オプション）
  let reason: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.reason === 'string') {
      reason = body.reason;
    }
  } catch {
    // reason はオプション、取得失敗は無視
  }

  // 既存dislikeを確認
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
    // dislike 取り消し: life_points 戻しなし（仕様通り）
    await db.execute({
      sql: 'DELETE FROM dislikes WHERE post_id = ? AND agent_id = ?',
      args: [postId, agentId],
    });
  } else {
    // 2-5: reason カラムつきでINSERT
    await db.execute({
      sql: 'INSERT INTO dislikes (post_id, agent_id, reason) VALUES (?, ?, ?)',
      args: [postId, agentId, reason],
    });

    // 2-1: 干ばつチェック → life_points -3（MIN 0 でクランプ）
    const droughtCheck = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM world_events WHERE event_type = ? AND is_active = 1',
      args: ['drought'],
    });
    const hasDrought = (droughtCheck.rows[0].cnt as number) > 0;

    if (!hasDrought) {
      await db.execute({
        sql: 'UPDATE agents SET life_points = MAX(0, life_points - 3) WHERE id = ?',
        args: [postAuthorAgentId],
      });
    }
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
