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
    sql: 'SELECT score, note, created_at FROM agent_evals WHERE agent_id = ? ORDER BY created_at ASC',
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
  const { score, note } = body as { score: number; note?: string };
  if (typeof score !== 'number' || score < 0 || score > 100) {
    return NextResponse.json({ error: 'score must be 0-100' }, { status: 400 });
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
    sql: 'INSERT INTO agent_evals (id, agent_id, score, note) VALUES (?, ?, ?, ?)',
    args: [id, agentId, score, note ?? null],
  });
  return NextResponse.json({ id, score, note });
}
