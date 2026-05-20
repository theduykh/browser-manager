import { useEffect } from 'react';
import { heartbeat } from '../api/browser';

export function useHeartbeat(profileId: number | null, intervalMs = 60_000) {
  useEffect(() => {
    if (profileId === null) return;
    let cancelled = false;

    const tick = async () => {
      try { await heartbeat(profileId); } catch { /* swallow — UI will reflect via polling */ }
    };

    tick();
    const handle = setInterval(() => { if (!cancelled) tick(); }, intervalMs);
    return () => { cancelled = true; clearInterval(handle); };
  }, [profileId, intervalMs]);
}
