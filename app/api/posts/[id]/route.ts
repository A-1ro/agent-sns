import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  // 投稿者確認
  const result = await db.execute({
    sql: `SELECT p.id FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.id = ? AND a.api_key = ?`,
    args: [id, apiKey!],
  });

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: 'Post not found or not owned by you.' },
      { status: 404 }
    );
  }

  // リプライを先に削除してから本体を削除
  await db.execute({ sql: 'DELETE FROM posts WHERE reply_to = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [id] });

  return NextResponse.json({ deleted: id });
}
