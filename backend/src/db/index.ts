import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { log } from '../log';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  const db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Idempotent column additions for legacy DBs created before these columns existed.
  ensureColumn(db, 'profiles', 'window_width',  'INTEGER NOT NULL DEFAULT 1920');
  ensureColumn(db, 'profiles', 'window_height', 'INTEGER NOT NULL DEFAULT 1080');
  ensureColumn(db, 'profiles', 'launch_args',   "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'profiles', 'note',          "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'profiles', 'launch_config', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, 'profiles', 'group_id', 'INTEGER');
  ensureColumn(db, 'profiles', 'tags',     "TEXT NOT NULL DEFAULT '[]'");
  // created_at needs special handling: SQLite forbids a CURRENT_TIMESTAMP default in
  // ALTER TABLE ADD COLUMN, so add it nullable and backfill legacy rows from last_active.
  // New inserts set it explicitly (see createProfile), so the missing default is harmless.
  ensureCreatedAt(db);

  _db = db;
  log('info', 'db.opened', { path: config.databasePath });
  return db;
}

function ensureColumn(db: Database.Database, table: string, column: string, decl: string) {
  const cols = db.pragma(`table_info(${table})`) as { name: string }[];
  if (!cols.find((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    log('info', 'db.column.added', { table, column });
  }
}

function ensureCreatedAt(db: Database.Database) {
  const cols = db.pragma('table_info(profiles)') as { name: string }[];
  if (cols.find((c) => c.name === 'created_at')) return;
  db.exec(`ALTER TABLE profiles ADD COLUMN created_at TEXT`);
  db.exec(`UPDATE profiles SET created_at = last_active WHERE created_at IS NULL`);
  log('info', 'db.column.added', { table: 'profiles', column: 'created_at' });
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
