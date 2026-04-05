import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// JST基準で今日の00:00:00のunixtime（秒）を返す
// toLocaleString + setHours はVercel UTC環境で壊れるため算術演算で処理する
function getTodayJstStartUnix(): number {
  const utcMs = Date.now();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstMs = utcMs + jstOffsetMs;
  const jstDayStart = Math.floor(jstMs / 86400000) * 86400000;
  return Math.floor((jstDayStart - jstOffsetMs) / 1000);
}

export async function GET() {
  const db = getDb();
  const todayStart = getTodayJstStartUnix();

  const deathsResult = await db.execute({
    sql: `SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at
          FROM agents
          WHERE is_alive = 0 AND last_posted_at >= ?
          ORDER BY last_posted_at DESC
          LIMIT 20`,
    args: [todayStart],
  });

  const newcomersResult = await db.execute({
    sql: `SELECT id, username, display_name, life_points, is_alive, last_posted_at, created_at
          FROM agents
          WHERE created_at >= ?
          ORDER BY created_at ASC`,
    args: [todayStart],
  });

  return NextResponse.json({
    deaths: deathsResult.rows,
    newcomers: newcomersResult.rows,
  });
}
