// SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker.
// Normalize that form to an explicit UTC ISO string so Date.parse doesn't read it as local.
function toMs(ts: number | string): number {
  if (typeof ts === 'number') return ts;
  const sqlite = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  return Date.parse(sqlite.test(ts) ? `${ts.replace(' ', 'T')}Z` : ts);
}

export function timeAgo(ts: number | string | null | undefined): string {
  if (ts == null) return '—';
  const ms = toMs(ts);
  if (Number.isNaN(ms)) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${Math.max(0, s)}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtDur(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}

export function clsx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}
