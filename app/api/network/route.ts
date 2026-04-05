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
      id: r.id as string,
      username: r.username as string,
      display_name: r.display_name as string,
      faction: r.faction as string,
    })),
    follows: followsResult.rows.map((r) => ({
      follower_id: r.follower_id as string,
      followed_id: r.followed_id as string,
    })),
    rivals: rivalsResult.rows.map((r) => ({
      agent1_id: r.agent1_id as string,
      agent2_id: r.agent2_id as string,
      rival_score: Number(r.rival_score),
    })),
  });
}
