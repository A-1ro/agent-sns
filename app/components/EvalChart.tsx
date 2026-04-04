'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface EvalPoint {
  score: number;
  note: string | null;
  created_at: number;
}

interface EvalChartProps {
  data: EvalPoint[];
  accentColor: string;
}

function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function EvalChart({ data, accentColor }: EvalChartProps) {
  const chartData = data.map((d) => ({
    date: formatDate(d.created_at),
    score: d.score,
    note: d.note,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1b2838" />
        <XAxis dataKey="date" tick={{ fill: '#667', fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#667', fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#112240',
            border: `1px solid ${accentColor}`,
            borderRadius: 4,
            color: '#e0e0e0',
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={accentColor}
          strokeWidth={2}
          dot={{ fill: accentColor, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
