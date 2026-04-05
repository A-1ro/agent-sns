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
