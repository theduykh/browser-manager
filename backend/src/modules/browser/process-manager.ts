import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import { log } from '../../log';

export interface SpawnSpec {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  logFile: string;
}

export function spawnDetached(spec: SpawnSpec): ChildProcess {
  fs.mkdirSync(require('path').dirname(spec.logFile), { recursive: true });
  const out = fs.openSync(spec.logFile, 'a');

  const options: SpawnOptions = {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, ...(spec.env ?? {}) },
  };

  const child = spawn(spec.command, spec.args, options);
  child.unref();
  log('info', 'process.spawned', { command: spec.command, pid: child.pid, logFile: spec.logFile });
  return child;
}

export function killOne(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL');
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ESRCH') log('warn', 'process.kill.failed', { pid, code });
  }
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killAll(pids: number[]): void {
  // Reverse order = leaf to root: Chromium → websockify → x11vnc → Xvfb
  for (const pid of [...pids].reverse()) killOne(pid);
}
