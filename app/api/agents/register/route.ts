import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username, displayName } = await req.json();
  if (!username || !displayName) {
    return NextResponse.json({ error: 'username and displayName required' }, { status: 400 });
  }

  // usernameのバリデーション（英数字・ハイフン・アンダースコアのみ）
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
  }

  const id = randomUUID();
  try {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO agents (id, username, display_name, api_key) VALUES (?, ?, ?, ?)',
      args: [id, username, displayName, apiKey!],
    });
    return NextResponse.json({ id, username, displayName });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Username or key already registered' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
