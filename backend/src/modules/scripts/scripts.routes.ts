import { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import {
  listScripts, getScript, createScript, updateScript, deleteScript,
  scriptExists, getScriptSteps, getLatestReport,
  InvalidScriptError, DuplicateScriptError, ScriptNotFoundError,
} from './scripts.service';
import { startRun, getRun, RunOptions } from './script-runner';
import {
  startRecording, getRecording, stopRecording,
  AlreadyRecordingError, RecordingNotFoundError,
} from './recorder';
import { ProfileNotFoundError, ProfileNotOpenError } from './cdp';

function uniqueInts(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (Number.isInteger(n) && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

export function scriptsRouter(db: Database.Database): Router {
  const r = Router();

  r.get('/', (_req: Request, res: Response) => {
    res.json(listScripts(db));
  });

  r.post('/', (req: Request, res: Response) => {
    try {
      res.status(201).json(createScript(db, {
        name: String(req.body?.name ?? ''),
        description: req.body?.description !== undefined ? String(req.body.description) : undefined,
        steps: req.body?.steps,
      }));
    } catch (err) {
      if (err instanceof InvalidScriptError)   return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateScriptError) return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  // Literal routes before '/:id' so they are not shadowed by the param route.
  r.get('/runs/:runId', (req: Request, res: Response) => {
    const report = getRun(req.params.runId);
    if (!report) return res.status(404).json({ error: 'RUN_NOT_FOUND' });
    res.json(report);
  });

  r.post('/record/start', async (req: Request, res: Response) => {
    const profileId = Number(req.body?.profile_id);
    if (!Number.isInteger(profileId)) return res.status(400).json({ error: 'BAD_PROFILE_ID' });
    try {
      res.json(await startRecording(db, profileId));
    } catch (err) {
      if (err instanceof ProfileNotFoundError)   return res.status(404).json({ error: err.code, message: err.message });
      if (err instanceof ProfileNotOpenError)    return res.status(409).json({ error: err.code, message: err.message });
      if (err instanceof AlreadyRecordingError)  return res.status(409).json({ error: err.code, message: err.message });
      res.status(500).json({ error: 'RECORD_START_FAILED', message: String(err) });
    }
  });

  r.get('/record/:recordingId', (req: Request, res: Response) => {
    try {
      res.json(getRecording(req.params.recordingId));
    } catch (err) {
      if (err instanceof RecordingNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.post('/record/:recordingId/stop', async (req: Request, res: Response) => {
    try {
      res.json(await stopRecording(req.params.recordingId));
    } catch (err) {
      if (err instanceof RecordingNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      res.status(500).json({ error: 'RECORD_STOP_FAILED', message: String(err) });
    }
  });

  r.get('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      res.json(getScript(db, id));
    } catch (err) {
      if (err instanceof ScriptNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.get('/:id/report', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    res.json(getLatestReport(db, id));
  });

  r.patch('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      res.json(updateScript(db, id, {
        name: req.body?.name !== undefined ? String(req.body.name) : undefined,
        description: req.body?.description !== undefined ? String(req.body.description) : undefined,
        steps: req.body?.steps,
      }));
    } catch (err) {
      if (err instanceof InvalidScriptError)   return res.status(400).json({ error: err.code, message: err.message });
      if (err instanceof ScriptNotFoundError)  return res.status(404).json({ error: err.code, message: err.message });
      if (err instanceof DuplicateScriptError) return res.status(409).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    try {
      deleteScript(db, id);
      res.status(204).end();
    } catch (err) {
      if (err instanceof ScriptNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  r.post('/:id/run', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'BAD_ID' });
    const targets = uniqueInts(req.body?.targets);
    if (targets.length === 0) return res.status(400).json({ error: 'NO_TARGETS', message: 'targets must be a non-empty array of profile ids' });
    const options: RunOptions = {
      autoAllocate: req.body?.autoAllocate === true,
      stopOnError: req.body?.stopOnError !== false,
    };
    try {
      const row = scriptExists(db, id);
      const runId = startRun(db, { id: row.id, name: row.name, steps: getScriptSteps(row) }, targets, options);
      res.status(202).json({ run_id: runId });
    } catch (err) {
      if (err instanceof ScriptNotFoundError) return res.status(404).json({ error: err.code, message: err.message });
      throw err;
    }
  });

  return r;
}
