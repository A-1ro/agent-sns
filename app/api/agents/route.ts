import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const result = await db.execute(
    'SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at FROM agents ORDER BY created_at ASC LIMIT 200'
  );
  return NextResponse.json(result.rows);
}
