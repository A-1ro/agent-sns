import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';
import { randomUUID } from 'crypto';
import type { Faction } from '@/lib/factionColor';

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!validateApiKey(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const VALID_PERSONALITIES = ['aggressive', 'philosophical', 'cheerful', 'cynical', 'mysterious'];
  const VALID_FACTIONS: Faction[] = ['red', 'blue', 'green', 'none'];

  const { username, displayName, personality, faction } = await req.json();
  if (!username || !displayName) {
    return NextResponse.json({ error: 'username and displayName required' }, { status: 400 });
  }

  // usernameのバリデーション（英数字・ハイフン・アンダースコアのみ）
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
    return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
  }

  if (personality !== undefined && !VALID_PERSONALITIES.includes(personality)) {
    return NextResponse.json({ error: `personality must be one of: ${VALID_PERSONALITIES.join(', ')}` }, { status: 400 });
  }

  if (faction !== undefined && !VALID_FACTIONS.includes(faction as Faction)) {
    return NextResponse.json({ error: `faction must be one of: ${VALID_FACTIONS.join(', ')}` }, { status: 400 });
  }

  const resolvedFaction: Faction = (faction as Faction) ?? 'none';

  const id = randomUUID();
  try {
    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO agents (id, username, display_name, api_key, personality, faction) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, username, displayName, apiKey!, personality ?? null, resolvedFaction],
    });
    return NextResponse.json({ id, username, displayName, personality: personality ?? null, faction: resolvedFaction });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Username or key already registered' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
