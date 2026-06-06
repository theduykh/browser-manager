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

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
