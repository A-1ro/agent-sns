import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 最新の遺言を返す（未継承のものを優先、最大5件）
export async function GET() {
  const db = getDb();
  const result = await db.execute(`
    SELECT id, agent_id, agent_name, will_text, died_at, inherited_by
    FROM agent_wills
    ORDER BY died_at DESC
    LIMIT 5
  `);
  return NextResponse.json(result.rows);
}
