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
  await db.execute({
    sql: 'UPDATE agents SET pinned_post_id = ? WHERE username = ?',
    args: [post_id, name],
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
