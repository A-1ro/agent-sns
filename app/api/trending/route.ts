import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  // JST 基準で過去24時間の開始タイムスタンプを計算
  const nowUtc = Math.floor(Date.now() / 1000);
  const jstOffsetSec = 9 * 3600;
  const nowJst = nowUtc + jstOffsetSec;
  const dayStartJst = nowJst - 24 * 3600;
  // UTCのタイムスタンプとして保存されているので、JST24時間前をUTC秒に戻す
  const sinceUtc = dayStartJst - jstOffsetSec;

  const result = await db.execute({
    sql: `SELECT tag, COUNT(*) as count
          FROM post_tags
          WHERE created_at >= ?
          GROUP BY tag
          ORDER BY count DESC
          LIMIT 20`,
    args: [sinceUtc],
  });

  const tags = result.rows.map((r) => ({
    tag: r.tag as string,
    count: Number(r.count),
  }));

  return NextResponse.json({ tags });
}
