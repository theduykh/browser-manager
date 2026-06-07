import type Database from 'better-sqlite3';
import { ScriptRow, Script, ScriptStep, RunReport, ScriptRunRow, ScriptRunSummary, RunStatus } from './types';
import { validateSteps, InvalidScriptError } from './steps';

export { InvalidScriptError };
export class DuplicateScriptError extends Error { code = 'DUPLICATE_SCRIPT' as const; }
export class ScriptNotFoundError extends Error { code = 'SCRIPT_NOT_FOUND' as const; }

const NAME_MAX = 100;
const DESC_MAX = 2000;

function validateName(name: string): void {
  if (name.length < 1 || name.length > NAME_MAX)
    throw new InvalidScriptError(`name must be 1..${NAME_MAX} characters`);
}

function validateDescription(desc: string): void {
  if (desc.length > DESC_MAX) throw new InvalidScriptError(`description too long (>${DESC_MAX} chars)`);
}

function parseSteps(raw: string): ScriptStep[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as ScriptStep[]) : [];
  } catch {
    return [];
  }
}

interface ScriptListRow extends ScriptRow {
  run_status: RunStatus | null;
  run_started_at: string | null;
  run_finished_at: string | null;
}

function rowToScript(r: ScriptRow, lastRun: ScriptRunSummary | null): Script {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    steps: parseSteps(r.steps),
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_run: lastRun,
  };
}

export function listScripts(db: Database.Database): Script[] {
  const rows = db
    .prepare(
      `SELECT s.*, r.status AS run_status, r.started_at AS run_started_at, r.finished_at AS run_finished_at
         FROM scripts s
         LEFT JOIN script_runs r ON r.script_id = s.id
        ORDER BY s.id ASC`,
    )
    .all() as ScriptListRow[];
  return rows.map((r) =>
    rowToScript(r, r.run_status
      ? { status: r.run_status, started_at: r.run_started_at!, finished_at: r.run_finished_at! }
      : null),
  );
}

export function getScript(db: Database.Database, id: number): Script {
  const row = db.prepare(`SELECT * FROM scripts WHERE id=?`).get(id) as ScriptRow | undefined;
  if (!row) throw new ScriptNotFoundError(`script ${id} not found`);
  const run = db.prepare(`SELECT status, started_at, finished_at FROM script_runs WHERE script_id=?`).get(id) as
    | ScriptRunSummary
    | undefined;
  return rowToScript(row, run ?? null);
}

export interface ScriptCreateInput {
  name: string;
  description?: string;
  steps?: unknown;
}

export function createScript(db: Database.Database, input: ScriptCreateInput): Script {
  const name = input.name.trim();
  validateName(name);
  const description = (input.description ?? '').toString();
  validateDescription(description);
  const steps = validateSteps(input.steps ?? []);

  const dup = db.prepare(`SELECT id FROM scripts WHERE name=?`).get(name);
  if (dup) throw new DuplicateScriptError(`script name '${name}' already exists`);

  const row = db
    .prepare(
      `INSERT INTO scripts (name, description, steps) VALUES (?, ?, ?) RETURNING *`,
    )
    .get(name, description, JSON.stringify(steps)) as ScriptRow;
  return rowToScript(row, null);
}

export interface ScriptUpdateInput {
  name?: string;
  description?: string;
  steps?: unknown;
}

export function updateScript(db: Database.Database, id: number, input: ScriptUpdateInput): Script {
  const row = db.prepare(`SELECT * FROM scripts WHERE id=?`).get(id) as ScriptRow | undefined;
  if (!row) throw new ScriptNotFoundError(`script ${id} not found`);

  const name = input.name !== undefined ? input.name.trim() : row.name;
  if (name !== row.name) {
    validateName(name);
    const dup = db.prepare(`SELECT id FROM scripts WHERE name=? AND id<>?`).get(name, id);
    if (dup) throw new DuplicateScriptError(`script name '${name}' already exists`);
  }

  const description = input.description !== undefined ? input.description.toString() : row.description;
  validateDescription(description);

  const steps = input.steps !== undefined ? validateSteps(input.steps) : parseSteps(row.steps);

  const updated = db
    .prepare(
      `UPDATE scripts
          SET name=?, description=?, steps=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? RETURNING *`,
    )
    .get(name, description, JSON.stringify(steps), id) as ScriptRow;

  const run = db.prepare(`SELECT status, started_at, finished_at FROM script_runs WHERE script_id=?`).get(id) as
    | ScriptRunSummary
    | undefined;
  return rowToScript(updated, run ?? null);
}

export function deleteScript(db: Database.Database, id: number): void {
  const info = db.prepare(`DELETE FROM scripts WHERE id=?`).run(id);
  if (info.changes === 0) throw new ScriptNotFoundError(`script ${id} not found`);
}

export function scriptExists(db: Database.Database, id: number): ScriptRow {
  const row = db.prepare(`SELECT * FROM scripts WHERE id=?`).get(id) as ScriptRow | undefined;
  if (!row) throw new ScriptNotFoundError(`script ${id} not found`);
  return row;
}

export function getScriptSteps(row: ScriptRow): ScriptStep[] {
  return parseSteps(row.steps);
}

// Latest-only persistence: one row per script_id, overwritten each run.
export function saveRunReport(db: Database.Database, report: RunReport): void {
  db.prepare(
    `INSERT INTO script_runs (script_id, status, report, started_at, finished_at)
       VALUES (@script_id, @status, @report, @started_at, @finished_at)
     ON CONFLICT(script_id) DO UPDATE SET
       status=excluded.status,
       report=excluded.report,
       started_at=excluded.started_at,
       finished_at=excluded.finished_at`,
  ).run({
    script_id: report.scriptId,
    status: report.status,
    report: JSON.stringify(report),
    started_at: report.startedAt,
    finished_at: report.finishedAt ?? new Date().toISOString(),
  });
}

export function getLatestReport(db: Database.Database, scriptId: number): RunReport | null {
  const row = db.prepare(`SELECT report FROM script_runs WHERE script_id=?`).get(scriptId) as
    | Pick<ScriptRunRow, 'report'>
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.report) as RunReport;
  } catch {
    return null;
  }
}
