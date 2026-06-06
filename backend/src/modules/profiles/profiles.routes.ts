import { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import {
  listProfiles, createProfile, deleteProfile, resetProfile, updateProfile,
  InvalidNameError, InvalidConfigError, DuplicateProfileError,
  ProfileNotFoundError, ProfileBusyError, ProfileUpdateInput,
} from './profiles.service';
import { ProfileConfigInput, LaunchConfig } from '../../types';

function pickConfig(body: any): ProfileConfigInput {
  const out: ProfileConfigInput = {};
  if (body?.window_width  !== undefined) out.window_width  = Number(body.window_width);
  if (body?.window_height !== undefined) out.window_height = Number(body.window_height);
  if (body?.launch_args   !== undefined) out.launch_args   = String(body.launch_args);
  if (body?.note          !== undefined) out.note          = String(body.note);
  if (body?.launch_config !== undefined && typeof body.launch_config === 'object' && body.launch_config !== null) {
    out.launch_config = body.launch_config as LaunchConfig;
  }
  return out;
}

export function profilesRouter(db: Database.Database): Router {
  const r = Router();

  r.get('/', (_req: Request, res: Response) => {
    res.json(listProfiles(db));
  });

  r.post('/', (req: Request, res: Response) => {
    const profileName = String(req.body?.profile_name ?? '').trim();
    try {
      res.status(201).json(createProfile(db, profileName, pickConfig(req.body)));
    } catch (err) {
      if (err instanceof InvalidNameError)      return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof InvalidConfigError)    return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateProfileError) return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.patch('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    const input: ProfileUpdateInput = pickConfig(req.body);
    if (req.body?.profile_name !== undefined) input.profile_name = String(req.body.profile_name);
    try {
      res.json(updateProfile(db, id, input));
    } catch (err) {
      if (err instanceof InvalidNameError)      return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof InvalidConfigError)    return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof ProfileNotFoundError)  return res.status(404).json({ error: err.code, message: err.message });
      if (err instanceof ProfileBusyError)      return res.status(409).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateProfileError) return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.post('/:id/reset', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      res.json(resetProfile(db, id));
    } catch (err) {
      if (err instanceof ProfileNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      deleteProfile(db, id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof ProfileNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      if (err instanceof ProfileBusyError)     return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  return r;
}
