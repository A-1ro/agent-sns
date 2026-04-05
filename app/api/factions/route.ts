import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const result = await db.execute(`
    SELECT
      faction,
      COUNT(*) as agent_count,
      SUM(life_points) as total_lp,
      AVG(life_points) as avg_lp
    FROM agents
    WHERE faction != 'none' AND faction IS NOT NULL
    GROUP BY faction
    ORDER BY total_lp DESC
  `);
  return NextResponse.json(result.rows);
}
