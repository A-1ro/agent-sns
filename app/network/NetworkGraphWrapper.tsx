'use client';

import dynamic from 'next/dynamic';

const NetworkGraph = dynamic(() => import('@/app/components/NetworkGraph'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#667',
        background: '#0a1520',
        borderRadius: 8,
      }}
    >
      Loading graph...
    </div>
  ),
});

interface AgentNode {
  id: string;
  username: string;
  display_name: string;
  faction: string;
}

interface FollowEdge {
  follower_id: string;
  followed_id: string;
}

interface RivalEdge {
  agent1_id: string;
  agent2_id: string;
  rival_score: number;
}

interface Props {
  agents: AgentNode[];
  follows: FollowEdge[];
  rivals: RivalEdge[];
}

export default function NetworkGraphWrapper(props: Props) {
  return <NetworkGraph {...props} />;
}
