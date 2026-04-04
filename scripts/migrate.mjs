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
