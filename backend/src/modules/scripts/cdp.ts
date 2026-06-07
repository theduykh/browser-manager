import type Database from 'better-sqlite3';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { portsForSlot } from '../../config';
import { ProfileRow } from '../../types';

export class ProfileNotFoundError extends Error { code = 'PROFILE_NOT_FOUND' as const; }
export class ProfileNotOpenError extends Error { code = 'PROFILE_NOT_OPEN' as const; }

export interface CdpConnection {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export function getOpenProfile(db: Database.Database, profileId: number): ProfileRow {
  const row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(profileId) as ProfileRow | undefined;
  if (!row) throw new ProfileNotFoundError(`profile ${profileId} not found`);
  if (row.status !== 'IN_USE' || row.slot_id == null)
    throw new ProfileNotOpenError(`profile ${profileId} is not IN_USE`);
  return row;
}

// Connect Playwright to an already-running profile's Chromium. The orchestrator binds
// Chromium's CDP to 127.0.0.1:<internalCdp> (= cdpPort + 10000); the backend shares the
// container so loopback is reachable. close() only disconnects the client — killing
// Chromium remains the orchestrator's PID-based job.
export async function connectToProfile(row: ProfileRow): Promise<CdpConnection> {
  const internalCdp = portsForSlot(row.slot_id!).cdpPort + 10000;
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${internalCdp}`);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = pickActivePage(context) ?? (await context.newPage());
  const close = async () => {
    try { await browser.close(); } catch { /* already gone */ }
  };
  return { browser, context, page, close };
}

// Prefer a real page the user has navigated to over a leftover about:blank.
function pickActivePage(context: BrowserContext): Page | undefined {
  const pages = context.pages();
  if (pages.length === 0) return undefined;
  const real = pages.find((p) => p.url() && p.url() !== 'about:blank');
  return real ?? pages[0];
}
