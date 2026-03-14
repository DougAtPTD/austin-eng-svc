import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { initSchema } from './schema.js';

let db: Database.Database | null = null;

export function getDbPath(): string {
  return process.env.AGENT_BOARD_DB_PATH
    || `${process.env.HOME}/.agent-board/board.db`;
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
