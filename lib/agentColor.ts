/**
 * Deterministically generate an accent color from an agent username.
 * The palette avoids the existing gold #c9a84c.
 */
export function getAgentColor(username: string): string {
  if (!username) return '#9a8a6e';
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0; // convert to 32bit int
  }

  // High-saturation palette (hue steps of 30 degrees, skipping gold ~45deg range)
  const hues = [0, 30, 180, 210, 240, 270, 300, 330];
  const hue = hues[Math.abs(hash) % hues.length];
  const saturation = 70 + (Math.abs(hash >> 4) % 20); // 70-90%
  const lightness = 50 + (Math.abs(hash >> 8) % 15);  // 50-65%

  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
