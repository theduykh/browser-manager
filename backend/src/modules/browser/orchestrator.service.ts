import * as fs from 'fs';
import * as path from 'path';
import type Database from 'better-sqlite3';
import { config, portsForSlot } from '../../config';
import { log } from '../../log';
import { ProfileRow, Profile, rowToProfile, parseLaunchConfig } from '../../types';
import {
  allocate as dbAllocate,
  releaseRow,
  markCorrupt,
  persistPids,
} from './slot-allocator';
import { spawnDetached, killAll } from './process-manager';
import { cleanProfileLocks } from './profile-lock-cleaner';

const CHROME_BIN_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  // Playwright base image path varies by version; resolved at runtime via find.
].filter(Boolean) as string[];

let _resolvedChrome: string | null = null;

function resolveChromiumBin(): string {
  if (_resolvedChrome) return _resolvedChrome;
  for (const candidate of CHROME_BIN_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      _resolvedChrome = candidate;
      return candidate;
    }
  }
  // Fallback: search /ms-playwright for a chrome binary.
  const root = '/ms-playwright';
  if (fs.existsSync(root)) {
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile() && e.name === 'chrome') {
          _resolvedChrome = full;
          return full;
        }
      }
    }
  }
  throw new Error('chromium binary not found (set CHROMIUM_PATH)');
}

async function waitForCdp(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`CDP not ready on :${port} (lastErr=${String(lastErr)})`);
}

function clearChromiumCrashState(folder: string): void {
  try {
    const defaultDir = path.join(folder, 'Default');
    fs.mkdirSync(defaultDir, { recursive: true });
    const prefsPath = path.join(defaultDir, 'Preferences');

    let prefs: any = {};
    let changed = false;

    if (fs.existsSync(prefsPath)) {
      const content = fs.readFileSync(prefsPath, 'utf8');
      try {
        prefs = JSON.parse(content);
      } catch {
        prefs = {};
      }
    } else {
      changed = true; // file does not exist, we will create it
    }

    if (!prefs.profile) prefs.profile = {};
    if (prefs.profile.exit_type !== 'Normal' && prefs.profile.exit_type !== 'none') {
      prefs.profile.exit_type = 'Normal';
      changed = true;
    }
    if (prefs.profile.exited_cleanly !== true) {
      prefs.profile.exited_cleanly = true;
      changed = true;
    }

    if (!prefs.session) prefs.session = {};
    if (prefs.session.restore_on_startup !== 5) {
      prefs.session.restore_on_startup = 5;
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
      log('info', 'chromium.prefs.updated', { folder });
    }
  } catch (err) {
    log('warn', 'chromium.prefs.update_failed', { folder, err: String(err) });
  }
}

export async function allocateBrowser(
  db: Database.Database,
  opts: { profileId?: number } = {},
): Promise<Profile> {
  const row: ProfileRow = dbAllocate(db, opts.profileId);
  const slotId = row.slot_id!;
  const { display, vncPort, wsPort, cdpPort } = portsForSlot(slotId);
  // Chromium từ M111+ chặn HTTP request từ origin không phải loopback nội bộ.
  // Cho Chromium bind 127.0.0.1:<internal>, socat sẽ bridge 0.0.0.0:<cdpPort> → 127.0.0.1:<internal>.
  const internalCdp = cdpPort + 10000;
  const folder = row.folder_path;

  const width = row.window_width ?? 1920;
  const height = row.window_height ?? 1080;
  // Naive split: whitespace-separated tokens. Quoted args are not supported (document this).
  const extraArgs = (row.launch_args ?? '').split(/\s+/).filter((s) => s.length > 0);
  const lc = parseLaunchConfig(row.launch_config ?? '{}');
  const structuredArgs: string[] = [];
  if (lc.lang)                  structuredArgs.push(`--lang=${lc.lang}`);
  if (lc.proxy)                 structuredArgs.push(`--proxy-server=${lc.proxy}`);
  if (lc.disableWebSecurity)    structuredArgs.push('--disable-web-security');
  if (lc.disableExtensions)     structuredArgs.push('--disable-extensions');
  if (lc.muteAudio)             structuredArgs.push('--mute-audio');
  if (lc.ignoreCertErrors)      structuredArgs.push('--ignore-certificate-errors');
  if (lc.disableNotifications)  structuredArgs.push('--disable-notifications');
  if (lc.disablePopupBlocking)  structuredArgs.push('--disable-popup-blocking');

  log('info', 'allocate.start', {
    profile_id: row.id, slot_id: slotId, display, wsPort, cdpPort, width, height,
    extra_args_count: extraArgs.length, structured_args_count: structuredArgs.length,
  });

  fs.mkdirSync(folder, { recursive: true });
  cleanProfileLocks(folder);
  clearChromiumCrashState(folder);

  const pids: number[] = [];
  const logBase = `/tmp/slot_${slotId}`;

  try {
    const xvfb = spawnDetached({
      command: 'Xvfb',
      args: [display, '-screen', '0', `${width}x${height}x24`, '-nolisten', 'tcp'],
      logFile: `${logBase}_xvfb.log`,
    });
    pids.push(xvfb.pid!);
    await new Promise((r) => setTimeout(r, 400));

    const x11vnc = spawnDetached({
      command: 'x11vnc',
      args: [
        '-display', display,
        '-nopw',
        '-listen', 'localhost',
        '-xkb',
        '-forever',
        '-shared',
        '-rfbport', String(vncPort),
        '-quiet',
      ],
      logFile: `${logBase}_x11vnc.log`,
    });
    pids.push(x11vnc.pid!);
    await new Promise((r) => setTimeout(r, 300));

    const ws = spawnDetached({
      command: 'websockify',
      args: [`0.0.0.0:${wsPort}`, `localhost:${vncPort}`, '--web=/usr/share/novnc'],
      logFile: `${logBase}_websockify.log`,
    });
    pids.push(ws.pid!);
    await new Promise((r) => setTimeout(r, 200));

    const chromeBin = resolveChromiumBin();
    const chromium = spawnDetached({
      command: chromeBin,
      args: [
        `--user-data-dir=${folder}`,
        '--no-sandbox',
        '--enable-automation',
        '--disable-infobars',
        '--no-first-run',
        '--disable-encryption',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--hide-crash-restore-bubble',
        '--disable-features=Translate,VizDisplayCompositor',
        '--remote-debugging-address=127.0.0.1',
        `--remote-debugging-port=${internalCdp}`,
        '--remote-allow-origins=*',
        `--window-size=${width},${height}`,
        '--window-position=0,0',
        // structured args before raw args so raw args can override
        ...structuredArgs,
        ...extraArgs,
        'about:blank',
      ],
      env: { DISPLAY: display },
      logFile: `${logBase}_chromium.log`,
    });
    pids.push(chromium.pid!);

    // Đợi Chromium nghe nội bộ trước khi mở socat (tránh socat fail nhanh do upstream chưa sẵn sàng).
    await waitForCdp(internalCdp, config.cdpWaitMs);

    const socat = spawnDetached({
      command: 'socat',
      args: [
        `TCP-LISTEN:${cdpPort},fork,reuseaddr,bind=0.0.0.0`,
        `TCP:127.0.0.1:${internalCdp}`,
      ],
      logFile: `${logBase}_socat.log`,
    });
    pids.push(socat.pid!);

    persistPids(db, row.id, pids);

    log('info', 'allocate.ok', { profile_id: row.id, slot_id: slotId, pids });
    const refreshed = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(row.id) as ProfileRow;
    return rowToProfile(refreshed);
  } catch (err) {
    log('error', 'allocate.failed', { profile_id: row.id, slot_id: slotId, err: String(err) });
    killAll(pids);
    markCorrupt(db, row.id);
    throw err;
  }
}

export function releaseBrowser(db: Database.Database, profileId: number): { ok: true } {
  const row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(profileId) as ProfileRow | undefined;
  if (!row) throw new Error(`profile ${profileId} not found`);
  if (row.status !== 'IN_USE') {
    log('warn', 'release.noop', { profile_id: profileId, status: row.status });
    return { ok: true };
  }
  const pids: number[] = row.pids ? JSON.parse(row.pids) : [];
  killAll(pids);

  // belt-and-suspenders: pkill anything still bound to the slot's display/port
  // (in case the parent died but children survived re-parented to init/tini)
  const { display, vncPort, wsPort, cdpPort } = portsForSlot(row.slot_id!);
  const internalCdp = cdpPort + 10000;
  const { spawnSync } = require('child_process') as typeof import('child_process');
  spawnSync('pkill', ['-9', '-f', `Xvfb ${display}`]);
  spawnSync('pkill', ['-9', '-f', `x11vnc.*rfbport ${vncPort}`]);
  spawnSync('pkill', ['-9', '-f', `websockify .*:${wsPort}`]);
  spawnSync('pkill', ['-9', '-f', `socat TCP-LISTEN:${cdpPort}`]);
  spawnSync('pkill', ['-9', '-f', `remote-debugging-port=${internalCdp}`]);

  releaseRow(db, profileId);
  log('info', 'release.ok', { profile_id: profileId, slot_id: row.slot_id });
  return { ok: true };
}
