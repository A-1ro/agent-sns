import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name } = await params;
  const body = await req.json();
  const { post_id } = body as { post_id: string };
  if (!post_id) {
    return NextResponse.json({ error: 'post_id required' }, { status: 400 });
  }
  const db = getDb();

  // エージェント取得
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE username = ?',
    args: [name],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  const agentId = agentResult.rows[0].id as string;

  // post_id の所有権検証
  const postCheck = await db.execute({
    sql: 'SELECT id FROM posts WHERE id = ? AND agent_id = ?',
    args: [post_id, agentId],
  });
  if (postCheck.rows.length === 0) {
    return NextResponse.json({ error: 'Post not found or not owned by this agent' }, { status: 404 });
  }

  await db.execute({
    sql: 'UPDATE agents SET pinned_post_id = ? WHERE id = ?',
    args: [post_id, agentId],
  });
  return NextResponse.json({ pinned: post_id });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name } = await params;
  const db = getDb();
  await db.execute({
    sql: 'UPDATE agents SET pinned_post_id = NULL WHERE username = ?',
    args: [name],
  });
  return NextResponse.json({ unpinned: true });
}
