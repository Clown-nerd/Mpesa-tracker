import * as SQLite from 'expo-sqlite';

// ─── Database singleton ────────────────────────────────────────────────────────

let _db = null;

/**
 * Open (or return the cached) SQLite database handle.
 */
export function getDb() {
  if (!_db) {
    _db = SQLite.openDatabaseSync('mpesa_tracker.db');
  }
  return _db;
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

/**
 * Create all tables if they don't already exist.
 * Safe to call repeatedly – uses IF NOT EXISTS guards throughout.
 */
export function initDb() {
  const db = getDb();

  db.execSync(`PRAGMA journal_mode = WAL;`);

  // ── transactions ──────────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id               TEXT    PRIMARY KEY NOT NULL,
      confirmationCode TEXT,
      type             TEXT,
      amount           REAL    NOT NULL DEFAULT 0,
      party            TEXT,
      accountNumber    TEXT,
      paybillNumber    TEXT,
      date             TEXT    NOT NULL,
      rawMessage       TEXT,
      isExpense        INTEGER NOT NULL DEFAULT 0,
      isIncome         INTEGER NOT NULL DEFAULT 0,
      balance          REAL,
      category         TEXT,
      categorized      INTEGER NOT NULL DEFAULT 0,
      incomeSource     TEXT,
      note             TEXT,
      createdAt        TEXT    NOT NULL
    );
  `);

  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON transactions (date DESC);
  `);

  db.execSync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_confirmation
    ON transactions (confirmationCode)
    WHERE confirmationCode IS NOT NULL;
  `);

  // ── budgets ───────────────────────────────────────────────────────────────
  // Stored as a single JSON blob keyed by category id.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS budgets (
      id   INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
      data TEXT    NOT NULL DEFAULT '{}'
    );
  `);

  // ── settings ──────────────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // ── processed_sms_ids ─────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS processed_sms_ids (
      sms_id     TEXT    PRIMARY KEY NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── category_patterns ─────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS category_patterns (
      kind       TEXT    NOT NULL,
      party      TEXT    NOT NULL,
      category   TEXT    NOT NULL,
      count      INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (kind, party, category)
    );
  `);
}
