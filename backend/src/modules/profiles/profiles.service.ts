import type Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config';
import { ProfileRow, Profile, ProfileConfigInput, rowToProfile } from '../../types';
import { releaseBrowser } from '../browser/orchestrator.service';
import { cleanProfileLocks } from '../browser/profile-lock-cleaner';

// Allows email-style names (e.g. user@example.com). Filesystem-safe characters only.
const NAME_RE = /^[A-Za-z0-9._@-]{1,64}$/;
const MIN_DIM = 320;

function validateName(name: string): void {
  if (!NAME_RE.test(name)) throw new InvalidNameError(`name must match ${NAME_RE}`);
  // Reject path-traversal forms and OS-unfriendly edges
  if (name === '.' || name === '..') throw new InvalidNameError(`name cannot be '.' or '..'`);
  if (name.startsWith('.')) throw new InvalidNameError(`name cannot start with '.'`);
  if (name.endsWith('.'))   throw new InvalidNameError(`name cannot end with '.'`);
}
const MAX_DIM = 7680;
const NOTE_MAX = 2000;
const ARGS_MAX = 4000;

export class InvalidNameError extends Error { code = 'INVALID_NAME' as const; }
export class InvalidConfigError extends Error { code = 'INVALID_CONFIG' as const; }
export class DuplicateProfileError extends Error { code = 'DUPLICATE_PROFILE' as const; }
export class ProfileNotFoundError extends Error { code = 'PROFILE_NOT_FOUND' as const; }
export class ProfileBusyError extends Error { code = 'PROFILE_BUSY' as const; }

function normalizeConfig(input: ProfileConfigInput): {
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
} {
  const w = input.window_width ?? 1920;
  const h = input.window_height ?? 1080;
  if (!Number.isInteger(w) || w < MIN_DIM || w > MAX_DIM)
    throw new InvalidConfigError(`window_width must be integer in [${MIN_DIM},${MAX_DIM}]`);
  if (!Number.isInteger(h) || h < MIN_DIM || h > MAX_DIM)
    throw new InvalidConfigError(`window_height must be integer in [${MIN_DIM},${MAX_DIM}]`);

  const launch_args = (input.launch_args ?? '').toString();
  if (launch_args.length > ARGS_MAX)
    throw new InvalidConfigError(`launch_args too long (>${ARGS_MAX} chars)`);

  const note = (input.note ?? '').toString();
  if (note.length > NOTE_MAX)
    throw new InvalidConfigError(`note too long (>${NOTE_MAX} chars)`);

  return { window_width: w, window_height: h, launch_args, note };
}

export function listProfiles(db: Database.Database): Profile[] {
  const rows = db.prepare(`SELECT * FROM profiles ORDER BY id ASC`).all() as ProfileRow[];
  return rows.map(rowToProfile);
}

export function createProfile(
  db: Database.Database,
  profileName: string,
  cfg: ProfileConfigInput = {},
): Profile {
  validateName(profileName);
  const folder = path.join(config.profilesRoot, profileName);

  const existing = db.prepare(`SELECT id FROM profiles WHERE profile_name=?`).get(profileName);
  if (existing) throw new DuplicateProfileError(`profile_name '${profileName}' already exists`);

  const { window_width, window_height, launch_args, note } = normalizeConfig(cfg);

  fs.mkdirSync(folder, { recursive: true });
  const row = db
    .prepare(
      `INSERT INTO profiles
         (profile_name, folder_path, window_width, window_height, launch_args, note)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .get(profileName, folder, window_width, window_height, launch_args, note) as ProfileRow;
  return rowToProfile(row);
}

export interface ProfileUpdateInput extends ProfileConfigInput {
  profile_name?: string;
}

export function updateProfile(db: Database.Database, id: number, input: ProfileUpdateInput): Profile {
  const row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id) as ProfileRow | undefined;
  if (!row) throw new ProfileNotFoundError(`profile ${id} not found`);

  // Merge: only validate fields that were actually provided.
  const newName = input.profile_name !== undefined ? input.profile_name.trim() : row.profile_name;
  if (newName !== row.profile_name) {
    validateName(newName);
    if (row.status === 'IN_USE') throw new ProfileBusyError(`profile ${id} is IN_USE (cannot rename)`);
    const dup = db.prepare(`SELECT id FROM profiles WHERE profile_name=? AND id<>?`).get(newName, id);
    if (dup) throw new DuplicateProfileError(`profile_name '${newName}' already exists`);
  }

  const cfg = normalizeConfig({
    window_width:  input.window_width  ?? row.window_width,
    window_height: input.window_height ?? row.window_height,
    launch_args:   input.launch_args   ?? row.launch_args,
    note:          input.note          ?? row.note,
  });

  let newFolder = row.folder_path;
  if (newName !== row.profile_name) {
    newFolder = path.join(config.profilesRoot, newName);
    if (fs.existsSync(row.folder_path) && row.folder_path !== newFolder) {
      fs.renameSync(row.folder_path, newFolder);
    } else if (!fs.existsSync(newFolder)) {
      fs.mkdirSync(newFolder, { recursive: true });
    }
  }

  const updated = db
    .prepare(
      `UPDATE profiles
         SET profile_name=?, folder_path=?,
             window_width=?, window_height=?, launch_args=?, note=?,
             last_active=CURRENT_TIMESTAMP
       WHERE id=? RETURNING *`,
    )
    .get(newName, newFolder, cfg.window_width, cfg.window_height, cfg.launch_args, cfg.note, id) as ProfileRow;
  return rowToProfile(updated);
}

export function resetProfile(db: Database.Database, id: number): Profile {
  const row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id) as ProfileRow | undefined;
  if (!row) throw new ProfileNotFoundError(`profile ${id} not found`);

  if (row.status === 'IN_USE') {
    try { releaseBrowser(db, id); } catch { /* best effort */ }
  }

  cleanProfileLocks(row.folder_path);

  const updated = db
    .prepare(
      `UPDATE profiles
         SET status='IDLE', slot_id=NULL, ws_port=NULL, cdp_port=NULL,
             pids=NULL, allocated_at=NULL, last_active=CURRENT_TIMESTAMP
       WHERE id=? RETURNING *`,
    )
    .get(id) as ProfileRow;
  return rowToProfile(updated);
}

export function deleteProfile(db: Database.Database, id: number): void {
  const row = db.prepare(`SELECT * FROM profiles WHERE id=?`).get(id) as ProfileRow | undefined;
  if (!row) throw new ProfileNotFoundError(`profile ${id} not found`);
  if (row.status === 'IN_USE') throw new ProfileBusyError(`profile ${id} is IN_USE`);

  db.prepare(`DELETE FROM profiles WHERE id=?`).run(id);
  try {
    fs.rmSync(row.folder_path, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
