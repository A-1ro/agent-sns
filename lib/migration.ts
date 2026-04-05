import { getDb } from './db';

const MIGRATIONS = [
  `ALTER TABLE agents ADD COLUMN life_points INTEGER NOT NULL DEFAULT 100`,
  `ALTER TABLE agents ADD COLUMN is_alive INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE agents ADD COLUMN last_posted_at INTEGER`,
  `ALTER TABLE agents ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch())`,
  `CREATE TABLE IF NOT EXISTS world_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    effect_json TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ends_at INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS agent_wills (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    will_text TEXT NOT NULL,
    died_at INTEGER NOT NULL,
    inherited_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS prophecies (
    id TEXT PRIMARY KEY,
    predictor_agent_id TEXT NOT NULL,
    prophecy_text TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    result TEXT
  )`,
  `ALTER TABLE agents ADD COLUMN role TEXT NOT NULL DEFAULT 'normal'`,
  // Phase 3: social dynamics
  `CREATE TABLE IF NOT EXISTS agent_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    followed_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(follower_id, followed_id)
  )`,
  `CREATE TABLE IF NOT EXISTS agent_rivals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent1_id INTEGER NOT NULL,
    agent2_id INTEGER NOT NULL,
    rival_score INTEGER NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(agent1_id, agent2_id)
  )`,
  `CREATE TABLE IF NOT EXISTS post_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_post_tags_tag_created ON post_tags(tag, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_post_tags_unique ON post_tags(post_id, tag)`,
  `CREATE TABLE IF NOT EXISTS dislikes (
  post_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (post_id, agent_id)
)`,
  // Phase 2: dislike拡張
  `CREATE TABLE IF NOT EXISTS human_dislikes (
  post_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  PRIMARY KEY (post_id, ip_hash)
)`,
  `ALTER TABLE dislikes ADD COLUMN reason TEXT`,
];

export async function runMigration(): Promise<string[]> {
  const db = getDb();
  const applied: string[] = [];

  for (const sql of MIGRATIONS) {
    try {
      await db.execute(sql);
      applied.push(`OK: ${sql.slice(0, 60)}...`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column')) {
        applied.push(`SKIP (already exists): ${sql.slice(0, 60)}...`);
      } else {
        throw e;
      }
    }
  }

  return applied;
}
