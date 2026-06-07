import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { Page } from 'playwright';
import { log } from '../../log';
import { connectToProfile, getOpenProfile, CdpConnection } from './cdp';
import { ScriptStep, RecordingState } from './types';

export class AlreadyRecordingError extends Error { code = 'ALREADY_RECORDING' as const; }
export class RecordingNotFoundError extends Error { code = 'RECORDING_NOT_FOUND' as const; }

interface RawStep {
  id?: string;
  type: ScriptStep['type'];
  selector?: string;
  value?: string;
  key?: string;
  url?: string;
  t?: number;
}

interface Session extends RecordingState {
  connection: CdpConnection;
  drainTimer?: NodeJS.Timeout;
  lastClickAt: number;
}

const sessions = new Map<string, Session>();
const byProfile = new Map<number, string>();
const DRAIN_MS = 500;
const CLICK_NAV_WINDOW_MS = 1500;

export function getRecording(recordingId: string): RecordingState {
  const s = sessions.get(recordingId);
  if (!s) throw new RecordingNotFoundError(`recording ${recordingId} not found`);
  return {
    recordingId: s.recordingId, profileId: s.profileId, profileName: s.profileName,
    status: s.status, steps: s.steps, error: s.error,
  };
}

export async function startRecording(db: Database.Database, profileId: number): Promise<{ recording_id: string }> {
  const row = getOpenProfile(db, profileId);
  if (byProfile.has(profileId)) throw new AlreadyRecordingError(`profile ${profileId} is already being recorded`);

  const connection = await connectToProfile(row);
  const recordingId = randomUUID();
  const session: Session = {
    recordingId,
    profileId,
    profileName: row.profile_name,
    status: 'recording',
    steps: [],
    connection,
    lastClickAt: 0,
  };

  await connection.context.addInitScript({ content: RECORDER_SRC });
  for (const p of connection.context.pages()) {
    await p.evaluate(RECORDER_SRC).catch(() => { /* page may be navigating */ });
  }
  connection.context.on('page', (p) => {
    p.evaluate(RECORDER_SRC).catch(() => { /* ignore */ });
    attachNav(session, p);
  });
  attachNav(session, connection.page);

  // Seed an initial navigate so the script is self-contained on replay.
  const startUrl = connection.page.url();
  if (startUrl && startUrl !== 'about:blank') {
    appendStep(session, { type: 'navigate', url: startUrl });
  }

  session.drainTimer = setInterval(() => { void drain(db, session); }, DRAIN_MS);

  sessions.set(recordingId, session);
  byProfile.set(profileId, recordingId);
  log('info', 'recorder.start', { recording_id: recordingId, profile_id: profileId });
  return { recording_id: recordingId };
}

export async function stopRecording(recordingId: string): Promise<{ steps: ScriptStep[] }> {
  const session = sessions.get(recordingId);
  if (!session) throw new RecordingNotFoundError(`recording ${recordingId} not found`);
  if (session.status === 'recording') {
    if (session.drainTimer) clearInterval(session.drainTimer);
    try { await drainOnce(session); } catch { /* best effort final drain */ }
    session.status = 'stopped';
    await session.connection.close();
    byProfile.delete(session.profileId);
  }
  log('info', 'recorder.stop', { recording_id: recordingId, steps: session.steps.length });
  return { steps: session.steps };
}

function attachNav(session: Session, page: Page): void {
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    const at = Date.now();
    // Decide after the next drain so a click that caused this navigation is reflected.
    setTimeout(() => {
      if (session.status !== 'recording') return;
      if (!url || url === 'about:blank') return;
      if (at - session.lastClickAt < CLICK_NAV_WINDOW_MS) return; // click-driven nav
      appendStep(session, { type: 'navigate', url });
    }, DRAIN_MS + 200);
  });
}

async function drain(db: Database.Database, session: Session): Promise<void> {
  if (session.status !== 'recording') return;
  try {
    await drainOnce(session);
    db.prepare(`UPDATE profiles SET last_active=CURRENT_TIMESTAMP WHERE id=? AND status='IN_USE'`)
      .run(session.profileId);
  } catch (err) {
    log('warn', 'recorder.drain_failed', { recording_id: session.recordingId, err: String(err) });
  }
}

async function drainOnce(session: Session): Promise<void> {
  for (const page of session.connection.context.pages()) {
    const raw = (await page
      .evaluate(() => {
        const g = globalThis as unknown as { __bmRecorderSteps?: unknown[] };
        if (!g.__bmRecorderSteps) return [];
        return g.__bmRecorderSteps.splice(0);
      })
      .catch(() => [] as unknown[])) as RawStep[];
    for (const r of raw) {
      if (r.type === 'click') session.lastClickAt = Date.now();
      appendStep(session, r);
    }
  }
}

// Append with light dedup: collapse consecutive fills on the same selector, and
// drop a navigate that repeats the previous URL.
function appendStep(session: Session, raw: RawStep): void {
  const step = normalize(raw);
  if (!step) return;
  const last = session.steps[session.steps.length - 1];
  if (step.type === 'fill' && last && last.type === 'fill' && last.selector === step.selector) {
    last.value = step.value;
    return;
  }
  if (step.type === 'navigate' && last && last.type === 'navigate' && last.url === step.url) {
    return;
  }
  session.steps.push(step);
}

function normalize(r: RawStep): ScriptStep | null {
  const id = r.id && typeof r.id === 'string' ? r.id : randomUUID();
  switch (r.type) {
    case 'navigate': return r.url ? { id, type: 'navigate', url: r.url } : null;
    case 'click':    return r.selector ? { id, type: 'click', selector: r.selector } : null;
    case 'fill':     return r.selector ? { id, type: 'fill', selector: r.selector, value: r.value ?? '' } : null;
    case 'select':   return r.selector ? { id, type: 'select', selector: r.selector, value: r.value ?? '' } : null;
    case 'press':    return r.key ? { id, type: 'press', selector: r.selector, key: r.key } : null;
    case 'check':    return r.selector ? { id, type: 'check', selector: r.selector } : null;
    case 'uncheck':  return r.selector ? { id, type: 'uncheck', selector: r.selector } : null;
    default:         return null;
  }
}

// Injected into every recorded page (string, not a typed function, because it runs in
// the browser and may only use browser globals). Captures clicks, text input, and
// Enter/Tab into window.__bmRecorderSteps, which the Node side drains every DRAIN_MS.
const RECORDER_SRC = `(function () {
  var w = window;
  if (w.__bmRecorderInstalled) return;
  w.__bmRecorderInstalled = true;
  w.__bmRecorderSteps = w.__bmRecorderSteps || [];

  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) { return window.CSS && window.CSS.escape ? window.CSS.escape(s) : s; }
  function record(step) { step.id = uid(); step.t = Date.now(); w.__bmRecorderSteps.push(step); }
  function unique(sel) { try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; } }

  function cssPath(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 8) {
      if (node.id && unique('#' + esc(node.id))) { parts.unshift('#' + esc(node.id)); return parts.join(' > '); }
      var seg = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var sames = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (sames.length > 1) seg += ':nth-of-type(' + (sames.indexOf(node) + 1) + ')';
      }
      parts.unshift(seg);
      if (node === document.body) break;
      node = parent;
    }
    return parts.join(' > ');
  }

  function selectorFor(el) {
    if (!(el instanceof Element)) return null;
    if (el.id && unique('#' + esc(el.id))) return '#' + esc(el.id);
    var attrs = ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label', 'placeholder'];
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      var v = el.getAttribute(a);
      if (v) {
        var withTag = el.tagName.toLowerCase() + '[' + a + '=' + JSON.stringify(v) + ']';
        if (unique(withTag)) return withTag;
        var bare = '[' + a + '=' + JSON.stringify(v) + ']';
        if (unique(bare)) return bare;
      }
    }
    return cssPath(el);
  }

  function isTextEntry(el) {
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    if (tag === 'INPUT') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'email', 'password', 'search', 'url', 'tel', 'number', ''].indexOf(t) !== -1;
    }
    return false;
  }

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!(el instanceof Element)) return;
    if (isTextEntry(el)) return;
    var sel = selectorFor(el);
    if (sel) record({ type: 'click', selector: sel });
  }, true);

  // Collapse a run of keystrokes on one field into a single fill at the latest value.
  function recordFill(sel, value) {
    var arr = w.__bmRecorderSteps;
    var last = arr[arr.length - 1];
    if (last && last.type === 'fill' && last.selector === sel) { last.value = value; last.t = Date.now(); return; }
    record({ type: 'fill', selector: sel, value: value });
  }
  function valueOf(el) { return ('value' in el) ? el.value : (el.textContent || ''); }

  // 'input' fires on every keystroke of real typing (the user driving via Live View
  // rarely blurs the field, so 'change' alone would miss text entirely).
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!(el instanceof Element) || !isTextEntry(el)) return;
    var sel = selectorFor(el);
    if (sel) recordFill(sel, valueOf(el));
  }, true);

  // 'change' covers <select>, plus a backstop for autofill/paste on text fields.
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!(el instanceof Element)) return;
    var sel = selectorFor(el);
    if (!sel) return;
    if (el.tagName === 'SELECT') record({ type: 'select', selector: sel, value: el.value });
    else if (isTextEntry(el)) recordFill(sel, valueOf(el));
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    var el = e.target;
    var sel = (el instanceof Element) ? selectorFor(el) : null;
    record({ type: 'press', selector: sel || undefined, key: e.key });
  }, true);
})();`;
