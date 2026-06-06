import type Database from 'better-sqlite3';
import { Group, GroupRow } from '../../types';

const NAME_RE = /^[\p{L}\p{N} ._@-]{1,64}$/u;

export class InvalidGroupNameError extends Error { code = 'INVALID_GROUP_NAME' as const; }
export class DuplicateGroupError extends Error { code = 'DUPLICATE_GROUP' as const; }
export class GroupNotFoundError extends Error { code = 'GROUP_NOT_FOUND' as const; }

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!NAME_RE.test(trimmed)) throw new InvalidGroupNameError(`name must match ${NAME_RE}`);
  return trimmed;
}

export function groupExists(db: Database.Database, id: number): boolean {
  return !!db.prepare(`SELECT 1 FROM groups WHERE id=?`).get(id);
}

export function listGroups(db: Database.Database): Group[] {
  return db
    .prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM profiles p WHERE p.group_id = g.id) AS profile_count
       FROM groups g ORDER BY g.name COLLATE NOCASE ASC`,
    )
    .all() as Group[];
}

export function createGroup(db: Database.Database, name: string): Group {
  const validName = validateName(name);
  const dup = db.prepare(`SELECT id FROM groups WHERE name = ? COLLATE NOCASE`).get(validName);
  if (dup) throw new DuplicateGroupError(`group '${validName}' already exists`);

  const row = db
    .prepare(`INSERT INTO groups (name) VALUES (?) RETURNING *`)
    .get(validName) as GroupRow;
  return { ...row, profile_count: 0 };
}

export function renameGroup(db: Database.Database, id: number, name: string): Group {
  if (!groupExists(db, id)) throw new GroupNotFoundError(`group ${id} not found`);
  const validName = validateName(name);

  const dup = db
    .prepare(`SELECT id FROM groups WHERE name = ? COLLATE NOCASE AND id<>?`)
    .get(validName, id);
  if (dup) throw new DuplicateGroupError(`group '${validName}' already exists`);

  db.prepare(`UPDATE groups SET name=? WHERE id=?`).run(validName, id);

  const row = db
    .prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM profiles p WHERE p.group_id = g.id) AS profile_count
       FROM groups g WHERE g.id=?`,
    )
    .get(id) as Group;
  return row;
}

export function deleteGroup(db: Database.Database, id: number): void {
  if (!groupExists(db, id)) throw new GroupNotFoundError(`group ${id} not found`);

  db.transaction(() => {
    db.prepare(`UPDATE profiles SET group_id=NULL WHERE group_id=?`).run(id);
    db.prepare(`DELETE FROM groups WHERE id=?`).run(id);
  })();
}
