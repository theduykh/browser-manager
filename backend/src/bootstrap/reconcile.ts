import type Database from 'better-sqlite3';
import { spawnSync } from 'child_process';
import { log } from '../log';
import { ProfileRow } from '../types';
import { killAll, isAlive } from '../modules/browser/process-manager';
import { cleanProfileLocks } from '../modules/browser/profile-lock-cleaner';
import { portsForSlot } from '../config';

export function reconcileOnBoot(db: Database.Database): void {
  const stale = db
    .prepare(`SELECT * FROM profiles WHERE status='IN_USE'`)
    .all() as ProfileRow[];

  if (stale.length === 0) {
    log('info', 'reconcile.empty');
    return;
  }

  log('info', 'reconcile.start', { count: stale.length });

  for (const row of stale) {
    const pids: number[] = row.pids ? JSON.parse(row.pids) : [];
    const alive = pids.filter(isAlive);
    if (alive.length) killAll(alive);

    if (row.slot_id !== null) {
      const { display, vncPort, wsPort, cdpPort } = portsForSlot(row.slot_id);
      const internalCdp = cdpPort + 10000;
      spawnSync('pkill', ['-9', '-f', `Xvfb ${display}`]);
      spawnSync('pkill', ['-9', '-f', `x11vnc.*rfbport ${vncPort}`]);
      spawnSync('pkill', ['-9', '-f', `websockify .*:${wsPort}`]);
      spawnSync('pkill', ['-9', '-f', `socat TCP-LISTEN:${cdpPort}`]);
      spawnSync('pkill', ['-9', '-f', `remote-debugging-port=${internalCdp}`]);
    }

    cleanProfileLocks(row.folder_path);

    db.prepare(
      `UPDATE profiles
         SET status='IDLE', slot_id=NULL, ws_port=NULL, cdp_port=NULL,
             pids=NULL, allocated_at=NULL, last_active=CURRENT_TIMESTAMP
       WHERE id=?`,
    ).run(row.id);

    log('info', 'reconcile.reset', { profile_id: row.id, slot_id: row.slot_id });
  }

  log('info', 'reconcile.done', { count: stale.length });
}
