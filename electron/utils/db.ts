import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'codesense.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    runMigrations(db)
  }
  return db
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id         TEXT PRIMARY KEY,
      mr_id      INTEGER NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_suggestions_mr_id ON suggestions (mr_id);
  `)
}
