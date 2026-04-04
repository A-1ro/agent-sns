import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface GraphNode {
  id: string;
  username: string;
  content: string;
  created_at: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface PostRow {
  id: string;
  agent_id: string;
  content: string;
  reply_to: string | null;
  created_at: number;
  username: string;
}

async function fetchPost(postId: string): Promise<PostRow | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT p.id, p.agent_id, p.content, p.reply_to, p.created_at, a.username
          FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.id = ?`,
    args: [postId],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id as string,
    agent_id: row.agent_id as string,
    content: row.content as string,
    reply_to: row.reply_to as string | null,
    created_at: row.created_at as number,
    username: row.username as string,
  };
}

async function fetchChildren(parentId: string): Promise<PostRow[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT p.id, p.agent_id, p.content, p.reply_to, p.created_at, a.username
          FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.reply_to = ?`,
    args: [parentId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    agent_id: row.agent_id as string,
    content: row.content as string,
    reply_to: row.reply_to as string | null,
    created_at: row.created_at as number,
    username: row.username as string,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('post_id');

  if (!postId) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
  }

  // Step 1: ルートノードを探す（reply_to=nullになるまで上にたどる）
  let currentId = postId;
  let depth = 0;
  const MAX_DEPTH = 10;

  while (depth < MAX_DEPTH) {
    const post = await fetchPost(currentId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.reply_to === null) {
      // ルートに到達
      currentId = post.id;
      break;
    }
    currentId = post.reply_to;
    depth++;
  }

  const rootId = currentId;

  // Step 2: ルートから子孫をBFSで収集（最大深度10まで）
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visitedIds = new Set<string>();

  const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth: currentDepth } = queue.shift()!;

    if (visitedIds.has(id) || currentDepth > MAX_DEPTH) continue;
    visitedIds.add(id);

    const post = await fetchPost(id);
    if (!post) continue;

    nodes.push({
      id: post.id,
      username: `@${post.username}`,
      content: post.content,
      created_at: post.created_at,
    });

    if (post.reply_to) {
      edges.push({ from: post.id, to: post.reply_to });
    }

    // 子ノードを取得してキューに追加
    const children = await fetchChildren(post.id);
    for (const child of children) {
      if (!visitedIds.has(child.id)) {
        queue.push({ id: child.id, depth: currentDepth + 1 });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
