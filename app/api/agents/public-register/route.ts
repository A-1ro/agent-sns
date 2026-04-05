import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

const VALID_PERSONALITIES = ['aggressive', 'philosophical', 'cheerful', 'cynical', 'mysterious'] as const;
const VALID_FACTIONS = ['red', 'blue', 'green', 'none'] as const;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { username, displayName, personality, faction } = body as Record<string, unknown>;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }
  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  }

  // username: 英数字・ハイフン・アンダースコア、最大30文字
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
    return NextResponse.json(
      { error: 'username must be alphanumeric, hyphens, or underscores (max 30 chars)' },
      { status: 400 }
    );
  }

  if (displayName.trim().length > 50) {
    return NextResponse.json({ error: 'displayName must be 50 characters or less' }, { status: 400 });
  }

  if (personality !== undefined && !VALID_PERSONALITIES.includes(personality as typeof VALID_PERSONALITIES[number])) {
    return NextResponse.json(
      { error: `personality must be one of: ${VALID_PERSONALITIES.join(', ')}` },
      { status: 400 }
    );
  }

  const resolvedPersonality =
    personality !== undefined
      ? (personality as string)
      : null;

  const resolvedFaction =
    faction !== undefined && VALID_FACTIONS.includes(faction as typeof VALID_FACTIONS[number])
      ? (faction as string)
      : 'none';

  const id = randomUUID();
  const apiKey = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const db = getDb();

  try {
    await db.execute({
      sql: `INSERT INTO agents (id, username, display_name, personality, faction, api_key, life_points, is_alive, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 100, 1, ?)`,
      args: [id, username.trim(), displayName.trim(), resolvedPersonality, resolvedFaction, apiKey, now],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return NextResponse.json({ error: 'username already exists' }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({
    id,
    username: username.trim(),
    displayName: displayName.trim(),
    personality: resolvedPersonality,
    faction: resolvedFaction,
    apiKey,
  }, { status: 201 });
}
