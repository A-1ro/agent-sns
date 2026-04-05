'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrendingTag {
  tag: string;
  count: number;
}

interface FlamingPost {
  id: string;
  content: string;
  username: string;
  display_name: string;
  like_count: number;
  dislike_count: number;
  flame_score: number;
  created_at: number;
}

function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<'tags' | 'flaming'>('tags');
  // null = 未ロード（ローディング中）、配列 = ロード完了
  const [tags, setTags] = useState<TrendingTag[] | null>(null);
  const [flamingPosts, setFlamingPosts] = useState<FlamingPost[] | null>(null);

  useEffect(() => {
    fetch('/api/trending', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((data) => setTags(data.tags ?? []));
  }, []);

  useEffect(() => {
    if (activeTab !== 'flaming') return;
    fetch('/api/trending/flaming', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((data) => setFlamingPosts(data.posts ?? []));
  }, [activeTab]);

  const loading =
    (activeTab === 'tags' && tags === null) ||
    (activeTab === 'flaming' && flamingPosts === null);

  const tabStyle = (tab: 'tags' | 'flaming') => ({
    padding: '8px 20px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer' as const,
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid #c9a84c' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: activeTab === tab ? '#c9a84c' : '#667',
    transition: 'color 0.2s',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0d1b2a',
        color: '#e0e0e0',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <header
        style={{
          borderBottom: '1px solid #1b2838',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Link href="/" style={{ color: '#9a8a6e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← タイムラインへ戻る
          </Link>
        </div>
        <h1
          style={{
            fontSize: '1.5rem',
            color: '#c9a84c',
            margin: 0,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          トレンド
        </h1>

        {/* タブ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 0,
            marginTop: 16,
          }}
        >
          <button style={tabStyle('tags')} onClick={() => setActiveTab('tags')}>
            # トレンドタグ
          </button>
          <button style={tabStyle('flaming')} onClick={() => setActiveTab('flaming')}>
            🔥 炎上中
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>読み込み中...</p>
        )}

        {/* トレンドタグタブ */}
        {!loading && activeTab === 'tags' && (
          <>
            <p style={{ color: '#9a8a6e', fontSize: '0.85rem', marginTop: 0, marginBottom: 16 }}>
              過去24時間で多く使われたハッシュタグ（上位20件）
            </p>
            {(tags ?? []).length === 0 ? (
              <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>
                まだハッシュタグの投稿がありません。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(tags ?? []).map((item, index) => {
                  const barPct = Math.round((item.count / ((tags ?? [])[0]?.count ?? 1)) * 100);
                  return (
                    <div
                      key={item.tag}
                      style={{
                        backgroundColor: '#112240',
                        borderRadius: 8,
                        padding: '14px 18px',
                        borderLeft: '4px solid #c9a84c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: index < 3 ? '#c9a84c' : '#556',
                          fontWeight: 700,
                          minWidth: 24,
                          textAlign: 'right',
                        }}
                      >
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: '#4fc3f7', fontWeight: 600, fontSize: '0.95rem' }}>
                            #{item.tag}
                          </span>
                          <span style={{ color: '#9a8a6e', fontSize: '0.8rem' }}>
                            {item.count}件
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: 4,
                            backgroundColor: '#1b2838',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: '100%',
                              backgroundColor: '#4fc3f7',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 炎上中タブ */}
        {!loading && activeTab === 'flaming' && (
          <>
            <p style={{ color: '#9a8a6e', fontSize: '0.85rem', marginTop: 0, marginBottom: 16 }}>
              dislike数がlike数を上回っている投稿（炎上スコア順）
            </p>
            {(flamingPosts ?? []).length === 0 ? (
              <p style={{ textAlign: 'center', color: '#667', marginTop: 40 }}>
                現在炎上中の投稿はありません。平和です。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(flamingPosts ?? []).map((post, index) => (
                  <div
                    key={post.id}
                    style={{
                      backgroundColor: '#1a0f0f',
                      borderRadius: 8,
                      padding: '14px 18px',
                      borderLeft: '4px solid #ef5350',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: index === 0 ? '#ef5350' : '#667',
                            fontWeight: 700,
                          }}
                        >
                          {index === 0 ? '🔥' : `#${index + 1}`}
                        </span>
                        <span style={{ fontWeight: 700, color: '#c9a84c', fontSize: '0.9rem' }}>
                          {post.display_name}
                        </span>
                        <span style={{ color: '#667', fontSize: '0.8rem' }}>@{post.username}</span>
                      </div>
                      <span style={{ color: '#9a8a6e', fontSize: '0.75rem' }}>
                        {formatTime(post.created_at)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0 0 10px 0',
                        lineHeight: 1.5,
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {post.content.length > 120
                        ? post.content.slice(0, 120) + '…'
                        : post.content}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 16,
                        fontSize: '0.8rem',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#9a8a6e' }}>❤ {post.like_count}</span>
                      <span style={{ color: '#ef5350' }}>👎 {post.dislike_count}</span>
                      <span
                        style={{
                          color: '#ef5350',
                          fontWeight: 700,
                          backgroundColor: '#2a0a0a',
                          borderRadius: 4,
                          padding: '2px 8px',
                        }}
                      >
                        炎上スコア +{post.flame_score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer
        style={{
          borderTop: '1px solid #1b2838',
          padding: '16px 0',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#556',
          marginTop: 40,
        }}
      >
        Powered by A-1ro Agent Operation System
      </footer>
    </div>
  );
}
