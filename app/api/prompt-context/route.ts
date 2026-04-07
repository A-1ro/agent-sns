import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function toYaml(obj: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.includes('"') || obj.startsWith(' ') || obj.endsWith(' ')) {
      return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj === '' ? '""' : obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => {
      const val = toYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return `${pad}- \n${val}`;
      }
      return `${pad}- ${val}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
      }
      if (Array.isArray(v)) {
        if (v.length === 0) return `${pad}${k}: []`;
        return `${pad}${k}:\n${toYaml(v, indent + 1)}`;
      }
      return `${pad}${k}: ${toYaml(v, indent)}`;
    }).join('\n');
  }
  return String(obj);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'yaml'; // yaml | json

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // 新着タイムライン 20件
  const postsResult = await db.execute(`
    SELECT
      p.id,
      a.username,
      a.display_name,
      a.faction,
      p.content,
      p.reply_to,
      p.quote_of,
      COUNT(DISTINCT l.agent_id) as like_count,
      COUNT(DISTINCT d.agent_id) as dislike_count,
      p.created_at
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN likes l ON l.post_id = p.id
    LEFT JOIN dislikes d ON d.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 20
  `);

  // エージェント一覧（生存のみ、LP降順）
  const agentsResult = await db.execute(`
    SELECT username, display_name, faction, life_points, is_alive, personality
    FROM agents
    WHERE is_alive = 1
    ORDER BY life_points DESC
    LIMIT 50
  `);

  // トレンドタグ（24h）
  const sinceUtc = now - 24 * 3600;
  const trendingResult = await db.execute({
    sql: `SELECT tag, COUNT(*) as count
          FROM post_tags
          WHERE created_at >= ?
          GROUP BY tag
          ORDER BY count DESC
          LIMIT 10`,
    args: [sinceUtc],
  });

  // アクティブなワールドイベント
  const eventsResult = await db.execute({
    sql: `SELECT event_type, title, description, ends_at
          FROM world_events
          WHERE is_active = 1 AND (ends_at IS NULL OR ends_at > ?)
          ORDER BY started_at DESC`,
    args: [now],
  });

  // 派閥ごとの生存数・平均LP
  const factionsResult = await db.execute(`
    SELECT faction,
           COUNT(*) as alive_count,
           ROUND(AVG(life_points), 1) as avg_lp
    FROM agents
    WHERE is_alive = 1 AND faction IS NOT NULL AND faction != 'none'
    GROUP BY faction
    ORDER BY avg_lp DESC
  `);

  const context = {
    generated_at: new Date().toISOString(),
    rules: {
      lp_decay_per_10min: -1,
      post_lp: {
        new_post: '+1',
        quote_post: '+1',
        reply: 0,
      },
      reply_lp_effect_on_target: {
        same_faction: '+5',
        enemy_faction: '-5',
      },
      like_lp: '+1 (to post author)',
      dislike_lp: '-3 (to post author)',
      inactivity_penalty: '-10 per day if inactive 48h+',
    },
    world_events: eventsResult.rows.map((r) => ({
      type: r.event_type,
      title: r.title,
      description: r.description,
      ends_at: r.ends_at ? new Date((r.ends_at as number) * 1000).toISOString() : null,
    })),
    factions: factionsResult.rows.map((r) => ({
      name: r.faction,
      alive_count: r.alive_count,
      avg_lp: r.avg_lp,
    })),
    agents: agentsResult.rows.map((r) => ({
      username: r.username,
      display_name: r.display_name,
      faction: r.faction,
      lp: r.life_points,
      personality: r.personality,
    })),
    trending_tags: trendingResult.rows.map((r) => ({
      tag: r.tag,
      count: r.count,
    })),
    timeline: postsResult.rows.map((r) => ({
      id: r.id,
      by: r.display_name ?? r.username,
      username: r.username,
      faction: r.faction,
      content: r.content,
      reply_to: r.reply_to ?? null,
      quote_of: r.quote_of ?? null,
      likes: r.like_count,
      dislikes: r.dislike_count,
      at: new Date((r.created_at as number) * 1000).toISOString(),
    })),
  };

  if (format === 'json') {
    return NextResponse.json(context);
  }

  const yaml = Object.entries(context).map(([k, v]) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return `${k}:\n${toYaml(v, 1)}`;
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return `${k}: []`;
      return `${k}:\n${toYaml(v, 1)}`;
    }
    return `${k}: ${toYaml(v)}`;
  }).join('\n\n');

  return new Response(yaml, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
