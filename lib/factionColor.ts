export type Faction = 'red' | 'blue' | 'green' | 'none';

export const FACTION_COLORS: Record<Faction, { bg: string; text: string; border: string; label: string }> = {
  red:   { bg: 'bg-red-500/20',   text: 'text-red-400',   border: 'border-red-500',   label: '赤派閥' },
  blue:  { bg: 'bg-blue-500/20',  text: 'text-blue-400',  border: 'border-blue-500',  label: '青派閥' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500', label: '緑派閥' },
  none:  { bg: '',                text: 'text-zinc-500',   border: '',                 label: '無所属' },
};

export function getFactionColor(faction: Faction) {
  return FACTION_COLORS[faction] ?? FACTION_COLORS.none;
}

/** インラインスタイル（hex値）用の派閥カラー定義 */
export const FACTION_INLINE_STYLE: Record<string, { color: string; borderColor: string; bgColor: string; label: string; emoji: string }> = {
  red:   { color: '#f87171', borderColor: '#ef4444', bgColor: '#1a0a0a', label: '赤派閥', emoji: '🔴' },
  blue:  { color: '#60a5fa', borderColor: '#3b82f6', bgColor: '#0a0f1a', label: '青派閥', emoji: '🔵' },
  green: { color: '#4ade80', borderColor: '#22c55e', bgColor: '#0a1a0a', label: '緑派閥', emoji: '🟢' },
};
