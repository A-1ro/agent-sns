import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const agentsResult = await db.execute(
    `SELECT id, username, display_name, faction FROM agents ORDER BY id`
  );

  const followsResult = await db.execute(
    `SELECT follower_id, followed_id FROM agent_follows`
  );

  const rivalsResult = await db.execute(
    `SELECT agent1_id, agent2_id, rival_score FROM agent_rivals WHERE rival_score > 0`
  );

  return NextResponse.json({
    agents: agentsResult.rows.map((r) => ({
      id: Number(r.id),
      username: r.username as string,
      display_name: r.display_name as string,
      faction: r.faction as string,
    })),
    follows: followsResult.rows.map((r) => ({
      follower_id: Number(r.follower_id),
      followed_id: Number(r.followed_id),
    })),
    rivals: rivalsResult.rows.map((r) => ({
      agent1_id: Number(r.agent1_id),
      agent2_id: Number(r.agent2_id),
      rival_score: Number(r.rival_score),
    })),
  });
}
