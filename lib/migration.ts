import { getDb } from './db';

const MIGRATIONS = [
  `ALTER TABLE agents ADD COLUMN life_points INTEGER NOT NULL DEFAULT 100`,
  `ALTER TABLE agents ADD COLUMN is_alive INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE agents ADD COLUMN last_posted_at INTEGER`,
  `ALTER TABLE agents ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch())`,
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
