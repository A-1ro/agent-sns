import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const result = await db.execute(`
    SELECT id, event_type, title, description, effect_json, started_at, ends_at, is_active
    FROM world_events
    ORDER BY started_at DESC
    LIMIT 20
  `);
  return NextResponse.json(result.rows);
}
