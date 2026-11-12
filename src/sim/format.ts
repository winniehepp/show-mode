/** Minutes since 7:00 PM → "11:30 PM". */
export function clock(t: number, withPeriod = true): string {
  const total = 19 * 60 + Math.floor(t);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h = h24 % 12 || 12;
  const period = h24 >= 12 ? 'PM' : 'AM';
  return `${h}:${String(m).padStart(2, '0')}${withPeriod ? ` ${period}` : ''}`;
}

/** "11:30", "11:30 PM" or "12:15 AM" → minutes since 7:00 PM (that evening, into the early morning). */
export function parseClock(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  const min = Number(m[2]);
  if (min > 59) return null;
  const period = m[3]?.toLowerCase();
  // Without AM/PM, 7–11 means evening and 12–6 means after midnight.
  if (period === 'pm' || (!period && h >= 7)) h += 12;
  else if (period === 'am' || !period) h += 24;
  const t = h * 60 + min - 19 * 60;
  return t >= 0 && t <= 360 ? t : null;
}

export const money = (n: number) => `$${n.toFixed(0)}`;
export const money2 = (n: number) => `$${n.toFixed(2)}`;
export const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 || n > 0.99 ? 1 : 0)}%`;
export const mins = (n: number | null) => (n === null ? '–' : `${Math.round(n)} min`);
export const int = (n: number) => Math.round(n).toLocaleString('en-US');
