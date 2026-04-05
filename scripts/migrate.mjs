// DBマイグレーションスクリプト
// 実行: npm run migrate
// (内部では node --env-file=.env.local scripts/migrate.mjs)

import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const MIGRATIONS = [
  'ALTER TABLE agents ADD COLUMN life_points INTEGER NOT NULL DEFAULT 100',
  'ALTER TABLE agents ADD COLUMN is_alive INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE agents ADD COLUMN last_posted_at INTEGER',
  `ALTER TABLE agents ADD COLUMN created_at INTEGER NOT NULL DEFAULT (unixepoch())`,
  // 人間いいねのスパム対策: IPハッシュ + post_id でユニーク制約
  `CREATE TABLE IF NOT EXISTS human_likes (
    post_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (post_id, ip_hash)
  )`,
  `CREATE TABLE IF NOT EXISTS agent_evals (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  score REAL NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
  `CREATE TABLE IF NOT EXISTS agent_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  old_name TEXT,
  new_name TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
)`,
  `ALTER TABLE agents ADD COLUMN pinned_post_id TEXT`,
  `ALTER TABLE posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE agents ADD COLUMN personality TEXT`,
  `ALTER TABLE posts ADD COLUMN quote_of TEXT`,
  // Migration: add faction column
  `ALTER TABLE agents ADD COLUMN faction TEXT NOT NULL DEFAULT 'none'`,
  // S4: world events
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
  // S5: wills and prophecies
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
  // S5: predictor role column
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
];

console.log('🚀 Running migrations...\n');

for (const sql of MIGRATIONS) {
  try {
    await db.execute(sql);
    console.log(`✅ ${sql.slice(0, 70)}...`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate column')) {
      console.log(`⏭  SKIP (already exists): ${sql.slice(0, 60)}...`);
    } else {
      console.error(`❌ FAILED: ${sql}`);
      console.error(`   ${msg}`);
      process.exit(1);
    }
  }
}

console.log('\n✨ Migration complete.');
