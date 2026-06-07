import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { Page } from 'playwright';
import { config } from '../../config';
import { log } from '../../log';
import { ProfileRow } from '../../types';
import { allocateBrowser, releaseBrowser } from '../browser/orchestrator.service';
import { connectToProfile, CdpConnection } from './cdp';
import { runStep } from './step-interpreter';
import { saveRunReport } from './scripts.service';
import { ScriptStep, RunReport, TargetResult, StepResult } from './types';

export interface RunOptions {
  autoAllocate: boolean;
  stopOnError: boolean;
}

interface RunContext {
  report: RunReport;
  steps: ScriptStep[];
  options: RunOptions;
}

// In-memory registry of runs. Holds live progress during execution and stays
// queryable after completion (until restart). Capped to avoid unbounded growth.
const runs = new Map<string, RunContext>();
const MAX_RETAINED_RUNS = 50;

export function getRun(runId: string): RunReport | undefined {
  return runs.get(runId)?.report;
}

function retain(runId: string, ctx: RunContext): void {
  if (runs.size >= MAX_RETAINED_RUNS) {
    const oldest = runs.keys().next().value as string | undefined;
    if (oldest) runs.delete(oldest);
  }
  runs.set(runId, ctx);
}

export function startRun(
  db: Database.Database,
  script: { id: number; name: string; steps: ScriptStep[] },
  profileIds: number[],
  options: RunOptions,
): string {
  const runId = randomUUID();
  const targets: TargetResult[] = profileIds.map((profileId) => {
    const row = db.prepare(`SELECT profile_name FROM profiles WHERE id=?`).get(profileId) as
      | { profile_name: string }
      | undefined;
    return {
      profileId,
      profileName: row?.profile_name ?? `#${profileId}`,
      status: 'pending',
      allocated: false,
      steps: script.steps.map((s): StepResult => ({ stepId: s.id, type: s.type, status: 'pending' })),
    };
  });

  const report: RunReport = {
    runId,
    scriptId: script.id,
    scriptName: script.name,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    targets,
  };
  const ctx: RunContext = { report, steps: script.steps, options };
  retain(runId, ctx);

  void execute(db, ctx).catch((err) => {
    log('error', 'script.run.crashed', { run_id: runId, err: String(err) });
    report.status = 'failed';
    report.finishedAt = new Date().toISOString();
    try { saveRunReport(db, report); } catch { /* best effort */ }
  });

  return runId;
}

async function execute(db: Database.Database, ctx: RunContext): Promise<void> {
  const { report, steps, options } = ctx;
  log('info', 'script.run.start', {
    run_id: report.runId, script_id: report.scriptId, targets: report.targets.length,
  });

  await pool(report.targets, config.scriptRunConcurrency, (t) => runTarget(db, t, steps, options));

  const passed = report.targets.filter((t) => t.status === 'passed').length;
  const failed = report.targets.filter((t) => t.status === 'failed').length;
  report.status = failed === 0 ? 'passed' : passed === 0 ? 'failed' : 'partial';
  report.finishedAt = new Date().toISOString();

  saveRunReport(db, report);
  log('info', 'script.run.done', { run_id: report.runId, status: report.status });
}

async function runTarget(
  db: Database.Database,
  target: TargetResult,
  steps: ScriptStep[],
  options: RunOptions,
): Promise<void> {
  let row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(target.profileId) as ProfileRow | undefined;
  if (!row) {
    failTarget(target, 'profile not found');
    return;
  }

  let connection: CdpConnection | undefined;
  try {
    if (row.status !== 'IN_USE') {
      if (!options.autoAllocate) {
        failTarget(target, 'profile is not open (enable auto-allocate to run on idle profiles)');
        return;
      }
      target.status = 'allocating';
      await allocateBrowser(db, { profileId: target.profileId });
      target.allocated = true;
      row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(target.profileId) as ProfileRow;
    }

    target.status = 'running';
    connection = await connectToProfile(row);
    await runSteps(db, connection.page, target, steps, options);
    target.status = target.steps.some((s) => s.status === 'failed') ? 'failed' : 'passed';
  } catch (err) {
    target.status = 'failed';
    target.error = firstLine(err);
    markRemainingSkipped(target);
  } finally {
    if (connection) await connection.close();
    if (target.allocated) {
      try { releaseBrowser(db, target.profileId); } catch (err) {
        log('warn', 'script.run.release_failed', { profile_id: target.profileId, err: String(err) });
      }
    }
  }
}

async function runSteps(
  db: Database.Database,
  page: Page,
  target: TargetResult,
  steps: ScriptStep[],
  options: RunOptions,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    const res = target.steps[i];
    res.status = 'running';
    const t0 = Date.now();
    try {
      await runStep(page, steps[i]);
      res.status = 'passed';
      res.durationMs = Date.now() - t0;
    } catch (err) {
      res.status = 'failed';
      res.durationMs = Date.now() - t0;
      res.error = firstLine(err);
      target.screenshot = await captureScreenshot(page);
      if (options.stopOnError) {
        for (let j = i + 1; j < steps.length; j++) target.steps[j].status = 'skipped';
        return;
      }
    } finally {
      // Keep the zombie killer away during long runs.
      db.prepare(`UPDATE profiles SET last_active=CURRENT_TIMESTAMP WHERE id=? AND status='IN_USE'`)
        .run(target.profileId);
    }
  }
}

async function captureScreenshot(page: Page): Promise<string | undefined> {
  try {
    const buf = await page.screenshot({ type: 'jpeg', quality: 50 });
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function failTarget(target: TargetResult, error: string): void {
  target.status = 'failed';
  target.error = error;
  markRemainingSkipped(target);
}

function markRemainingSkipped(target: TargetResult): void {
  for (const s of target.steps) if (s.status === 'pending' || s.status === 'running') s.status = 'skipped';
}

function firstLine(err: unknown): string {
  return String(err instanceof Error ? err.message : err).split('\n')[0].slice(0, 500);
}

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const lanes = Array.from({ length: size }, async () => {
    while (idx < items.length) {
      const cur = items[idx++];
      await worker(cur);
    }
  });
  await Promise.all(lanes);
}
