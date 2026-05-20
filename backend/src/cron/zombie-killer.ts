import type Database from 'better-sqlite3';
import { config } from '../config';
import { log } from '../log';
import { ProfileRow } from '../types';
import { releaseBrowser } from '../modules/browser/orchestrator.service';

export function startZombieKiller(db: Database.Database): () => void {
  const tick = () => {
    try {
      const rows = db
        .prepare(
          `SELECT * FROM profiles
             WHERE status='IN_USE'
               AND last_active IS NOT NULL
               AND (strftime('%s','now') - strftime('%s', last_active)) * 1000 > ?`,
        )
        .all(config.maxSessionMs) as ProfileRow[];

      if (rows.length === 0) return;
      log('info', 'zombie.scan', { stale: rows.length });

      for (const row of rows) {
        log('warn', 'zombie.release', { profile_id: row.id, slot_id: row.slot_id, last_active: row.last_active });
        try {
          releaseBrowser(db, row.id);
        } catch (err) {
          log('error', 'zombie.release.failed', { profile_id: row.id, err: String(err) });
        }
      }
    } catch (err) {
      log('error', 'zombie.tick.failed', { err: String(err) });
    }
  };

  const handle = setInterval(tick, config.zombieScanMs);
  log('info', 'zombie.started', { intervalMs: config.zombieScanMs, sessionMs: config.maxSessionMs });
  return () => clearInterval(handle);
}
