import { NextRequest, NextResponse } from 'next/server';
import { runMigration } from '@/lib/migration';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runMigration();
  return NextResponse.json({ results });
}
