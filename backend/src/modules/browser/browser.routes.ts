import { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { allocateBrowser, releaseBrowser } from './orchestrator.service';
import {
  NoFreeSlotError, NoIdleProfileError, ProfileNotIdleError,
} from './slot-allocator';
import { ProfileRow } from '../../types';

export function browserRouter(db: Database.Database): Router {
  const r = Router();

  r.post('/allocate', async (req: Request, res: Response) => {
    const profileId = req.body?.profile_id !== undefined ? Number(req.body.profile_id) : undefined;
    if (profileId !== undefined && !Number.isInteger(profileId)) {
      return res.status(400).json({ error: 'BAD_PROFILE_ID' });
    }
    try {
      const profile = await allocateBrowser(db, { profileId });
      const host = req.hostname;
      res.json({
        profile_id: profile.id,
        slot_id: profile.slot_id,
        ws_port: profile.ws_port,
        cdp_port: profile.cdp_port,
        cdp_endpoint: `http://${host}:${profile.cdp_port}`,
        ws_url: `ws://${host}:${profile.ws_port}/`,
      });
    } catch (err) {
      if (err instanceof NoFreeSlotError) return res.status(503).json({ error: err.code, message: err.message });
      if (err instanceof NoIdleProfileError) return res.status(409).json({ error: err.code, message: err.message });
      if (err instanceof ProfileNotIdleError) return res.status(409).json({ error: err.code, message: err.message });
      res.status(500).json({ error: 'ALLOCATE_FAILED', message: String(err) });
    }
  });

  r.post('/heartbeat', (req: Request, res: Response) => {
    const profileId = Number(req.body?.profile_id);
    if (!Number.isInteger(profileId)) return res.status(400).json({ error: 'BAD_PROFILE_ID' });
    const row = db
      .prepare(
        `UPDATE profiles SET last_active=CURRENT_TIMESTAMP
         WHERE id=? AND status='IN_USE' RETURNING id, last_active`,
      )
      .get(profileId) as Pick<ProfileRow, 'id' | 'last_active'> | undefined;
    if (!row) return res.status(409).json({ error: 'NOT_IN_USE' });
    res.json({ ok: true, last_active: row.last_active });
  });

  r.post('/release', (req: Request, res: Response) => {
    const profileId = Number(req.body?.profile_id);
    if (!Number.isInteger(profileId)) return res.status(400).json({ error: 'BAD_PROFILE_ID' });
    try {
      res.json(releaseBrowser(db, profileId));
    } catch (err) {
      res.status(500).json({ error: 'RELEASE_FAILED', message: String(err) });
    }
  });

  return r;
}
