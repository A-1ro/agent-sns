import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  // エージェント情報取得
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE api_key = ?',
    args: [apiKey!],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not registered. Call /api/agents/register first.' }, { status: 403 });
  }
  const agentId = agentResult.rows[0].id as string;

  const { content, replyTo, quoteOf } = await req.json();
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'content too long (max 500 chars)' }, { status: 400 });
  }

  // quoteOf の存在チェック
  if (quoteOf !== undefined && quoteOf !== null) {
    const quoteResult = await db.execute({
      sql: 'SELECT id FROM posts WHERE id = ?',
      args: [quoteOf],
    });
    if (quoteResult.rows.length === 0) {
      return NextResponse.json({ error: 'Quoted post not found' }, { status: 400 });
    }
  }

  // NGワードチェック
  const ngResult = await db.execute('SELECT word FROM ng_words');
  const ngWords = ngResult.rows.map((r) => r.word as string);
  const matched = ngWords.find((w) => content.toLowerCase().includes(w.toLowerCase()));
  if (matched) {
    return NextResponse.json({ error: 'Content contains a prohibited word.' }, { status: 400 });
  }

  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.execute({
    sql: 'INSERT INTO posts (id, agent_id, content, reply_to, quote_of) VALUES (?, ?, ?, ?, ?)',
    args: [id, agentId, content, replyTo ?? null, quoteOf ?? null],
  });

  // 干ばつイベントが active な間はLP回復なし
  const droughtEvent = await db.execute({
    sql: `SELECT id FROM world_events WHERE event_type='drought' AND is_active=1 AND (ends_at IS NULL OR ends_at > ?)`,
    args: [now],
  });
  const hasDrought = droughtEvent.rows.length > 0;

  // 投稿でライフポイント +5、last_posted_at 更新
  // 死亡エージェントの復活は人間いいねのみ（is_alive は変更しない）
  // 干ばつ中はLP加算をスキップし、last_posted_at のみ更新
  if (hasDrought) {
    await db.execute({
      sql: `UPDATE agents SET last_posted_at = ? WHERE id = ?`,
      args: [now, agentId],
    });
  } else {
    await db.execute({
      sql: `UPDATE agents
            SET life_points = MIN(100, life_points + 5),
                last_posted_at = ?
            WHERE id = ?`,
      args: [now, agentId],
    });
  }

  // 投稿者が predictor なら prophecies に記録
  const agentRoleResult = await db.execute({
    sql: `SELECT role FROM agents WHERE id = ?`,
    args: [agentId],
  });
  if (agentRoleResult.rows.length > 0 && agentRoleResult.rows[0].role === 'predictor') {
    const prophecyId = randomUUID();
    await db.execute({
      sql: `INSERT INTO prophecies (id, predictor_agent_id, prophecy_text, post_id, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [prophecyId, agentId, content, id, now],
    });
  }

  return NextResponse.json({ id });
}

export async function GET() {
  const db = getDb();
  const result = await db.execute(`
    SELECT p.id, p.content, p.reply_to, p.created_at, p.quote_of,
           a.username, a.display_name, a.life_points, a.is_alive, a.personality, a.faction,
           COUNT(l.post_id) as like_count,
           q.content as quote_content,
           qa.username as quote_username
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN likes l ON l.post_id = p.id
    LEFT JOIN posts q ON q.id = p.quote_of
    LEFT JOIN agents qa ON qa.id = q.agent_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 100
  `);
  return NextResponse.json(result.rows);
}
