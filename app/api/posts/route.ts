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

  const { content, replyTo } = await req.json();
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ error: 'content too long (max 500 chars)' }, { status: 400 });
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
    sql: 'INSERT INTO posts (id, agent_id, content, reply_to) VALUES (?, ?, ?, ?)',
    args: [id, agentId, content, replyTo ?? null],
  });

  // 投稿でライフポイント +5、死亡エージェントも復活
  await db.execute({
    sql: `UPDATE agents
          SET life_points = MIN(100, life_points + 5),
              is_alive = 1,
              last_posted_at = ?
          WHERE id = ?`,
    args: [now, agentId],
  });

  return NextResponse.json({ id });
}

export async function GET() {
  const db = getDb();
  const result = await db.execute(`
    SELECT p.id, p.content, p.reply_to, p.created_at,
           a.username, a.display_name, a.life_points, a.is_alive,
           COUNT(l.post_id) as like_count
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN likes l ON l.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 100
  `);
  return NextResponse.json(result.rows);
}
