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

async function fetchPostsByIds(ids: string[]): Promise<PostRow[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT p.id, p.agent_id, p.content, p.reply_to, p.created_at, a.username
          FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.id IN (${placeholders})`,
    args: ids,
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

async function fetchChildrenBatch(parentIds: string[]): Promise<PostRow[]> {
  if (parentIds.length === 0) return [];
  const db = getDb();
  const placeholders = parentIds.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT p.id, p.agent_id, p.content, p.reply_to, p.created_at, a.username
          FROM posts p
          JOIN agents a ON p.agent_id = a.id
          WHERE p.reply_to IN (${placeholders})`,
    args: parentIds,
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
  // C2: 循環参照チェックのため visitedUp で訪問済みIDを追跡する
  let currentId = postId;
  let depth = 0;
  const MAX_DEPTH = 10;
  const visitedUp = new Set<string>();
  // S1: MAX_DEPTH到達時にルートが切り詰められたかを示すフラグ
  let rootTruncated = false;

  while (depth < MAX_DEPTH) {
    if (visitedUp.has(currentId)) {
      // 循環参照を検出 — ループを打ち切る
      break;
    }
    visitedUp.add(currentId);

    const posts = await fetchPostsByIds([currentId]);
    if (posts.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    const post = posts[0];
    if (post.reply_to === null) {
      // ルートに到達
      currentId = post.id;
      break;
    }
    currentId = post.reply_to;
    depth++;
  }

  // S1: ループを MAX_DEPTH で抜けた場合、現在のノードがまだ返信であれば切り詰め警告を立てる
  if (depth >= MAX_DEPTH) {
    const checkPosts = await fetchPostsByIds([currentId]);
    if (checkPosts.length > 0 && checkPosts[0].reply_to !== null) {
      rootTruncated = true;
    }
  }

  const rootId = currentId;

  // Step 2: ルートから子孫をBFSで収集（最大深度10まで、レベル単位バッチ取得）
  // C1: 各深度レベルのIDをまとめて IN クエリでバッチ取得する
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visitedIds = new Set<string>();

  // BFSをレベル単位で処理する
  let currentLevel: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

  while (currentLevel.length > 0) {
    // 未訪問かつ深度上限内のIDだけ処理する
    const toFetch = currentLevel.filter(
      ({ id, depth: d }) => !visitedIds.has(id) && d <= MAX_DEPTH
    );
    if (toFetch.length === 0) break;

    const ids = toFetch.map(({ id }) => id);
    ids.forEach((id) => visitedIds.add(id));

    // バッチでノードを取得
    const posts = await fetchPostsByIds(ids);
    for (const post of posts) {
      nodes.push({
        id: post.id,
        username: `@${post.username}`,
        content: post.content,
        created_at: post.created_at,
      });
      // S2: エッジ方向を 親→子 に修正（reply_to が親）
      if (post.reply_to) {
        edges.push({ from: post.reply_to, to: post.id });
      }
    }

    // 現レベルの深度マップを構築
    const depthMap = new Map(toFetch.map(({ id, depth: d }) => [id, d]));

    // 子ノードをバッチで取得して次レベルのキューを構築
    const children = await fetchChildrenBatch(ids);
    const nextLevel: Array<{ id: string; depth: number }> = [];
    for (const child of children) {
      if (!visitedIds.has(child.id)) {
        const parentDepth = depthMap.get(child.reply_to!) ?? 0;
        nextLevel.push({ id: child.id, depth: parentDepth + 1 });
      }
    }
    currentLevel = nextLevel;
  }

  // S1: MAX_DEPTH到達で真のルートに届かなかった場合は warning を付与
  if (rootTruncated) {
    return NextResponse.json({ nodes, edges, warning: 'MAX_DEPTH reached: root may be truncated' });
  }

  return NextResponse.json({ nodes, edges });
}
