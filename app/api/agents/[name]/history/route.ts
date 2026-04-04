import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getApiKey, validateApiKey } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const db = getDb();
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE username = ?',
    args: [name],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  const agentId = agentResult.rows[0].id as string;
  const result = await db.execute({
    sql: 'SELECT event_type, old_name, new_name, reason, created_at FROM agent_history WHERE agent_id = ? ORDER BY created_at ASC',
    args: [agentId],
  });
  return NextResponse.json(result.rows);
}

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
  const { event_type, old_name, new_name, reason } = body as {
    event_type: 'fired' | 'renamed';
    old_name?: string;
    new_name?: string;
    reason?: string;
  };
  if (!['fired', 'renamed'].includes(event_type)) {
    return NextResponse.json({ error: 'event_type must be fired or renamed' }, { status: 400 });
  }
  const db = getDb();
  const agentResult = await db.execute({
    sql: 'SELECT id FROM agents WHERE username = ?',
    args: [name],
  });
  if (agentResult.rows.length === 0) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  const agentId = agentResult.rows[0].id as string;
  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO agent_history (id, agent_id, event_type, old_name, new_name, reason) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, agentId, event_type, old_name ?? null, new_name ?? null, reason ?? null],
  });
  return NextResponse.json({ id, event_type });
}
