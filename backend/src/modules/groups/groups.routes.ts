import { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import {
  listGroups, createGroup, renameGroup, deleteGroup,
  InvalidGroupNameError, DuplicateGroupError, GroupNotFoundError,
} from './groups.service';

export function groupsRouter(db: Database.Database): Router {
  const r = Router();

  r.get('/', (_req: Request, res: Response) => {
    res.json(listGroups(db));
  });

  r.post('/', (req: Request, res: Response) => {
    const name = String(req.body?.name ?? '');
    try {
      res.status(201).json(createGroup(db, name));
    } catch (err) {
      if (err instanceof InvalidGroupNameError) return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateGroupError)   return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.patch('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    const name = String(req.body?.name ?? '');
    try {
      res.json(renameGroup(db, id, name));
    } catch (err) {
      if (err instanceof InvalidGroupNameError) return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof GroupNotFoundError)    return res.status(404).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateGroupError)   return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      deleteGroup(db, id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof GroupNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  return r;
}
