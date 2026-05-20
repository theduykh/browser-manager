import type Database from 'better-sqlite3';
import { config, portsForSlot } from '../../config';
import { ProfileRow } from '../../types';

export class NoFreeSlotError extends Error { code = 'NO_FREE_SLOT' as const; }
export class NoIdleProfileError extends Error { code = 'NO_IDLE_PROFILE' as const; }
export class ProfileNotIdleError extends Error { code = 'PROFILE_NOT_IDLE' as const; }

export function allocate(db: Database.Database, profileId?: number): ProfileRow {
  return db.transaction((): ProfileRow => {
    const used = db
      .prepare(`SELECT slot_id FROM profiles WHERE status='IN_USE' AND slot_id IS NOT NULL`)
      .all() as { slot_id: number }[];
    const usedSet = new Set(used.map((r) => r.slot_id));

    let slot = -1;
    for (let i = 1; i <= config.maxSlots; i++) {
      if (!usedSet.has(i)) { slot = i; break; }
    }
    if (slot === -1) throw new NoFreeSlotError(`no free slot (max ${config.maxSlots})`);

    const { wsPort, cdpPort } = portsForSlot(slot);

    let row: ProfileRow | undefined;
    if (profileId !== undefined) {
      row = db
        .prepare(
          `UPDATE profiles
             SET status='IN_USE', slot_id=?, ws_port=?, cdp_port=?,
                 allocated_at=CURRENT_TIMESTAMP, last_active=CURRENT_TIMESTAMP
           WHERE id=? AND status='IDLE'
           RETURNING *`,
        )
        .get(slot, wsPort, cdpPort, profileId) as ProfileRow | undefined;
      if (!row) throw new ProfileNotIdleError(`profile ${profileId} not IDLE or not found`);
    } else {
      row = db
        .prepare(
          `UPDATE profiles
             SET status='IN_USE', slot_id=?, ws_port=?, cdp_port=?,
                 allocated_at=CURRENT_TIMESTAMP, last_active=CURRENT_TIMESTAMP
           WHERE id=(SELECT id FROM profiles WHERE status='IDLE' ORDER BY last_active ASC LIMIT 1)
           RETURNING *`,
        )
        .get(slot, wsPort, cdpPort) as ProfileRow | undefined;
      if (!row) throw new NoIdleProfileError('no IDLE profile available');
    }
    return row;
  })();
}

export function releaseRow(db: Database.Database, profileId: number): ProfileRow | undefined {
  return db
    .prepare(
      `UPDATE profiles
         SET status='IDLE', slot_id=NULL, ws_port=NULL, cdp_port=NULL,
             pids=NULL, allocated_at=NULL, last_active=CURRENT_TIMESTAMP
       WHERE id=? AND status='IN_USE'
       RETURNING *`,
    )
    .get(profileId) as ProfileRow | undefined;
}

export function markCorrupt(db: Database.Database, profileId: number): void {
  db.prepare(
    `UPDATE profiles
       SET status='CORRUPT', slot_id=NULL, ws_port=NULL, cdp_port=NULL,
           pids=NULL, allocated_at=NULL, last_active=CURRENT_TIMESTAMP
     WHERE id=?`,
  ).run(profileId);
}

export function persistPids(db: Database.Database, profileId: number, pids: number[]): void {
  db.prepare(`UPDATE profiles SET pids=? WHERE id=?`).run(JSON.stringify(pids), profileId);
}
