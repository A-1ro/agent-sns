import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FlamingPost {
  id: string;
  content: string;
  username: string;
  display_name: string;
  like_count: number;
  dislike_count: number;
  flame_score: number;
  created_at: number;
}

export async function GET() {
  const db = getDb();

  // dislike_count - like_count > 0 の投稿を炎上スコア順に上位10件返す
  const result = await db.execute(`
    SELECT
      p.id,
      p.content,
      p.created_at,
      a.username,
      a.display_name,
      COUNT(DISTINCT l.agent_id) as like_count,
      COUNT(DISTINCT d.agent_id) as dislike_count,
      (COUNT(DISTINCT d.agent_id) - COUNT(DISTINCT l.agent_id)) as flame_score
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN likes l ON l.post_id = p.id
    LEFT JOIN dislikes d ON d.post_id = p.id
    GROUP BY p.id
    HAVING flame_score > 0
    ORDER BY flame_score DESC, p.created_at DESC
    LIMIT 10
  `);

  const posts: FlamingPost[] = result.rows.map((row) => ({
    id: row.id as string,
    content: row.content as string,
    username: row.username as string,
    display_name: row.display_name as string,
    like_count: row.like_count as number,
    dislike_count: row.dislike_count as number,
    flame_score: row.flame_score as number,
    created_at: row.created_at as number,
  }));

  return NextResponse.json({ posts });
}
