/**
 * storage.js — persistence layer backed by expo-sqlite (via src/utils/db.js).
 *
 * All exported function signatures are identical to the previous AsyncStorage
 * implementation so that nothing else in the codebase needs to change.
 *
 * The pure analytics helpers at the bottom (filterByMonth, sumByCategory,
 * totals, spendingByDay, spendingByMonth) are unchanged.
 */

import { getDb } from './db';

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Map a raw SQLite row object to the transaction shape the rest of the app
 * expects (boolean coercion, Date objects for date/createdAt).
 */
function rowToTransaction(row) {
  return {
    ...row,
    isExpense:   Boolean(row.isExpense),
    isIncome:    Boolean(row.isIncome),
    categorized: Boolean(row.categorized),
    amount:      Number(row.amount),
    balance:     row.balance != null ? Number(row.balance) : null,
    date:        new Date(row.date),
    createdAt:   new Date(row.createdAt),
  };
}

/**
 * Flatten a transaction object into the array of values expected by an INSERT
 * or UPDATE statement, handling boolean → 0/1 and Date → ISO string coercion.
 */
function txToRow(t) {
  return {
    id:               t.id,
    confirmationCode: t.confirmationCode ?? null,
    type:             t.type ?? null,
    amount:           Number(t.amount ?? 0),
    party:            t.party ?? null,
    accountNumber:    t.accountNumber ?? null,
    paybillNumber:    t.paybillNumber ?? null,
    date:             t.date instanceof Date ? t.date.toISOString() : String(t.date),
    rawMessage:       t.rawMessage ?? null,
    isExpense:        t.isExpense ? 1 : 0,
    isIncome:         t.isIncome ? 1 : 0,
    balance:          t.balance != null ? Number(t.balance) : null,
    category:         t.category ?? null,
    categorized:      t.categorized ? 1 : 0,
    incomeSource:     t.incomeSource ?? null,
    note:             t.note ?? null,
    createdAt:        t.createdAt instanceof Date
                        ? t.createdAt.toISOString()
                        : (t.createdAt ? String(t.createdAt) : new Date().toISOString()),
  };
}

// ─── Transactions ──────────────────────────────────────────────────────────────

/**
 * Insert a new transaction. Returns true on success, false if a duplicate
 * exists (matched on id or confirmationCode).
 */
export async function saveTransaction(transaction) {
  try {
    const db = getDb();
    const row = txToRow(transaction);

    // Check duplicate by id
    const byId = db.getFirstSync(
      'SELECT id FROM transactions WHERE id = ?',
      [row.id]
    );
    if (byId) return false;

    // Check duplicate by confirmationCode (when present)
    if (row.confirmationCode) {
      const byCode = db.getFirstSync(
        'SELECT id FROM transactions WHERE confirmationCode = ?',
        [row.confirmationCode]
      );
      if (byCode) return false;
    }

    db.runSync(
      `INSERT INTO transactions
         (id, confirmationCode, type, amount, party, accountNumber, paybillNumber,
          date, rawMessage, isExpense, isIncome, balance, category, categorized,
          incomeSource, note, createdAt)
       VALUES
         ($id, $confirmationCode, $type, $amount, $party, $accountNumber, $paybillNumber,
          $date, $rawMessage, $isExpense, $isIncome, $balance, $category, $categorized,
          $incomeSource, $note, $createdAt)`,
      {
        $id:               row.id,
        $confirmationCode: row.confirmationCode,
        $type:             row.type,
        $amount:           row.amount,
        $party:            row.party,
        $accountNumber:    row.accountNumber,
        $paybillNumber:    row.paybillNumber,
        $date:             row.date,
        $rawMessage:       row.rawMessage,
        $isExpense:        row.isExpense,
        $isIncome:         row.isIncome,
        $balance:          row.balance,
        $category:         row.category,
        $categorized:      row.categorized,
        $incomeSource:     row.incomeSource,
        $note:             row.note,
        $createdAt:        row.createdAt,
      }
    );
    return true;
  } catch (e) {
    console.error('saveTransaction error:', e);
    return false;
  }
}

/**
 * Return all transactions ordered newest-first.
 */
export async function getTransactions() {
  try {
    const db = getDb();
    const rows = db.getAllSync(
      'SELECT * FROM transactions ORDER BY date DESC, createdAt DESC'
    );
    return rows.map(rowToTransaction);
  } catch (e) {
    console.error('getTransactions error:', e);
    return [];
  }
}

/**
 * Return the N most-recent transactions ordered newest-first.
 * Used by analyticsCache for the fast-path fetch so screens don't load
 * the entire history on every tab focus.
 */
export async function getRecentTransactions(limit = 50) {
  try {
    const db = getDb();
    const rows = db.getAllSync(
      'SELECT * FROM transactions ORDER BY date DESC, createdAt DESC LIMIT ?',
      [limit]
    );
    return rows.map(rowToTransaction);
  } catch (e) {
    console.error('getRecentTransactions error:', e);
    return [];
  }
}

/**
 * Patch a transaction by id with the supplied key/value pairs.
 * Returns true on success, false if the transaction was not found.
 */
export async function updateTransaction(id, updates) {
  try {
    const db = getDb();

    // Build SET clause dynamically from updates
    const allowedKeys = [
      'confirmationCode', 'type', 'amount', 'party', 'accountNumber',
      'paybillNumber', 'date', 'rawMessage', 'isExpense', 'isIncome',
      'balance', 'category', 'categorized', 'incomeSource', 'note',
    ];

    const setClauses = [];
    const params = {};

    for (const key of allowedKeys) {
      if (key in updates) {
        setClauses.push(`${key} = $${key}`);
        let val = updates[key];
        if (typeof val === 'boolean') val = val ? 1 : 0;
        if (val instanceof Date) val = val.toISOString();
        params[`$${key}`] = val;
      }
    }

    if (setClauses.length === 0) return false;

    params.$id = id;
    const sql = `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = $id`;
    const result = db.runSync(sql, params);
    return result.changes > 0;
  } catch (e) {
    console.error('updateTransaction error:', e);
    return false;
  }
}

/**
 * Permanently delete a transaction by id.
 */
export async function deleteTransaction(id) {
  try {
    const db = getDb();
    db.runSync('DELETE FROM transactions WHERE id = ?', [id]);
    return true;
  } catch (e) {
    console.error('deleteTransaction error:', e);
    return false;
  }
}

/**
 * Wipe the entire transactions table.
 */
export async function clearAllTransactions() {
  try {
    const db = getDb();
    db.execSync('DELETE FROM transactions');
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Budgets ───────────────────────────────────────────────────────────────────

/**
 * Persist a budgets object (category → amount map) as a single JSON row.
 */
export async function saveBudgets(budgets) {
  try {
    const db = getDb();
    const json = JSON.stringify(budgets);
    // Upsert into the singleton row (id = 1)
    db.runSync(
      `INSERT INTO budgets (id, data) VALUES (1, $data)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      { $data: json }
    );
    return true;
  } catch (e) {
    console.error('saveBudgets error:', e);
    return false;
  }
}

/**
 * Retrieve the budgets object, or null if none has been saved yet.
 */
export async function getBudgets() {
  try {
    const db = getDb();
    const row = db.getFirstSync('SELECT data FROM budgets WHERE id = 1');
    if (!row) return null;
    return JSON.parse(row.data);
  } catch (e) {
    console.error('getBudgets error:', e);
    return null;
  }
}

// ─── Processed SMS IDs ────────────────────────────────────────────────────────

/**
 * Return all previously-processed SMS IDs as a plain string array.
 */
export async function getProcessedSmsIds() {
  try {
    const db = getDb();
    const rows = db.getAllSync('SELECT sms_id FROM processed_sms_ids');
    return rows.map((r) => r.sms_id);
  } catch (e) {
    return [];
  }
}

/**
 * Mark an SMS ID as processed.  Silently ignores duplicates.
 * Caps the table at 5 000 most-recent entries to prevent unbounded growth.
 */
export async function addProcessedSmsId(smsId) {
  try {
    const db = getDb();

    db.runSync(
      `INSERT OR IGNORE INTO processed_sms_ids (sms_id, created_at)
       VALUES (?, datetime('now'))`,
      [String(smsId)]
    );

    // Prune oldest beyond 5 000
    db.execSync(`
      DELETE FROM processed_sms_ids
      WHERE sms_id NOT IN (
        SELECT sms_id FROM processed_sms_ids
        ORDER BY created_at DESC
        LIMIT 5000
      )
    `);
  } catch (e) {
    console.error('addProcessedSmsId error:', e);
  }
}

// ─── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { currency: 'KES', theme: 'light', notifyOnNew: true };

/**
 * Load settings.  Falls back to DEFAULT_SETTINGS if nothing has been saved.
 */
export async function getSettings() {
  try {
    const db = getDb();
    const rows = db.getAllSync('SELECT key, value FROM settings');
    if (rows.length === 0) return { ...DEFAULT_SETTINGS };

    const settings = { ...DEFAULT_SETTINGS };
    for (const { key, value } of rows) {
      try {
        settings[key] = JSON.parse(value);
      } catch {
        settings[key] = value;
      }
    }
    return settings;
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist a settings object.  Each key is stored as an individual row so that
 * partial updates remain efficient.
 */
export async function saveSettings(settings) {
  try {
    const db = getDb();
    for (const [key, value] of Object.entries(settings)) {
      db.runSync(
        `INSERT INTO settings (key, value) VALUES ($key, $value)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        { $key: key, $value: JSON.stringify(value) }
      );
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ─── One-time AsyncStorage → SQLite migration ──────────────────────────────────

/**
 * Call once on first launch (before any other storage reads).
 *
 * Reads data from AsyncStorage (if the package is available), inserts it into
 * SQLite, then removes the AsyncStorage keys so the migration never runs again.
 *
 * Safe to call on every launch – it checks for the presence of a sentinel key
 * in the settings table and exits immediately if migration has already run.
 */
export async function migrateFromAsyncStorage() {
  try {
    const db = getDb();

    // Sentinel: if this key exists we've already migrated
    const sentinel = db.getFirstSync(
      `SELECT value FROM settings WHERE key = 'asyncStorageMigrated'`
    );
    if (sentinel) return;

    let AsyncStorage;
    try {
      AsyncStorage = require('@react-native-async-storage/async-storage').default;
    } catch {
      // Package not available – mark done and return
      _markMigrationDone(db);
      return;
    }

    console.log('[migration] Starting AsyncStorage → SQLite migration…');

    // ── Transactions ──────────────────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem('@mpesa_tracker:transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const t of parsed) {
          try {
            const row = txToRow({
              ...t,
              date:      t.date      ? new Date(t.date)      : new Date(),
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            });

            db.runSync(
              `INSERT OR IGNORE INTO transactions
                 (id, confirmationCode, type, amount, party, accountNumber,
                  paybillNumber, date, rawMessage, isExpense, isIncome, balance,
                  category, categorized, incomeSource, note, createdAt)
               VALUES
                 ($id, $confirmationCode, $type, $amount, $party, $accountNumber,
                  $paybillNumber, $date, $rawMessage, $isExpense, $isIncome, $balance,
                  $category, $categorized, $incomeSource, $note, $createdAt)`,
              {
                $id:               row.id,
                $confirmationCode: row.confirmationCode,
                $type:             row.type,
                $amount:           row.amount,
                $party:            row.party,
                $accountNumber:    row.accountNumber,
                $paybillNumber:    row.paybillNumber,
                $date:             row.date,
                $rawMessage:       row.rawMessage,
                $isExpense:        row.isExpense,
                $isIncome:         row.isIncome,
                $balance:          row.balance,
                $category:         row.category,
                $categorized:      row.categorized,
                $incomeSource:     row.incomeSource,
                $note:             row.note,
                $createdAt:        row.createdAt,
              }
            );
          } catch (rowErr) {
            console.warn('[migration] Skipping malformed transaction:', rowErr);
          }
        }
        await AsyncStorage.removeItem('@mpesa_tracker:transactions');
        console.log(`[migration] Migrated ${parsed.length} transactions.`);
      }
    } catch (e) {
      console.warn('[migration] Transactions migration failed:', e);
    }

    // ── Budgets ───────────────────────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem('@mpesa_tracker:budgets');
      if (raw) {
        db.runSync(
          `INSERT INTO budgets (id, data) VALUES (1, $data)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
          { $data: raw }
        );
        await AsyncStorage.removeItem('@mpesa_tracker:budgets');
        console.log('[migration] Migrated budgets.');
      }
    } catch (e) {
      console.warn('[migration] Budgets migration failed:', e);
    }

    // ── Settings ──────────────────────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem('@mpesa_tracker:settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [key, value] of Object.entries(parsed)) {
          db.runSync(
            `INSERT OR IGNORE INTO settings (key, value) VALUES ($key, $value)`,
            { $key: key, $value: JSON.stringify(value) }
          );
        }
        await AsyncStorage.removeItem('@mpesa_tracker:settings');
        console.log('[migration] Migrated settings.');
      }
    } catch (e) {
      console.warn('[migration] Settings migration failed:', e);
    }

    // ── Processed SMS IDs ─────────────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem('@mpesa_tracker:processed_sms');
      if (raw) {
        const ids = JSON.parse(raw);
        for (const smsId of ids) {
          db.runSync(
            `INSERT OR IGNORE INTO processed_sms_ids (sms_id, created_at)
             VALUES (?, datetime('now'))`,
            [String(smsId)]
          );
        }
        // Prune to 5 000
        db.execSync(`
          DELETE FROM processed_sms_ids
          WHERE sms_id NOT IN (
            SELECT sms_id FROM processed_sms_ids
            ORDER BY created_at DESC
            LIMIT 5000
          )
        `);
        await AsyncStorage.removeItem('@mpesa_tracker:processed_sms');
        console.log(`[migration] Migrated ${ids.length} processed SMS IDs.`);
      }
    } catch (e) {
      console.warn('[migration] Processed SMS IDs migration failed:', e);
    }

    // ── Category patterns ──────────────────────────────────────────────────
    try {
      const raw = await AsyncStorage.getItem('@mpesa_tracker:category_patterns');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Shape: { expense: { party: { category: count } }, income: { ... } }
        for (const [kind, parties] of Object.entries(parsed)) {
          for (const [party, categories] of Object.entries(parties)) {
            for (const [category, count] of Object.entries(categories)) {
              db.runSync(
                `INSERT OR IGNORE INTO category_patterns (kind, party, category, count)
                 VALUES (?, ?, ?, ?)`,
                [kind, party, category, Number(count)]
              );
            }
          }
        }
        await AsyncStorage.removeItem('@mpesa_tracker:category_patterns');
        console.log('[migration] Migrated category patterns.');
      }
    } catch (e) {
      console.warn('[migration] Category patterns migration failed:', e);
    }

    _markMigrationDone(db);
    console.log('[migration] AsyncStorage → SQLite migration complete.');
  } catch (e) {
    console.error('[migration] Unexpected error:', e);
  }
}

function _markMigrationDone(db) {
  db.runSync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('asyncStorageMigrated', 'true')`
  );
}

// ─── Analytics helpers (pure functions — unchanged) ────────────────────────────

/**
 * Get transactions filtered by month (0-indexed) and year.
 */
export function filterByMonth(transactions, month, year) {
  return transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

/**
 * Sum amounts by category for a list of transactions.
 */
export function sumByCategory(transactions) {
  const result = {};
  transactions
    .filter((t) => t.isExpense && t.category)
    .forEach((t) => {
      result[t.category] = (result[t.category] || 0) + t.amount;
    });
  return result;
}

/**
 * Total expenses and income from a list of transactions.
 */
export function totals(transactions) {
  const expenses = transactions
    .filter((t) => t.isExpense)
    .reduce((sum, t) => sum + t.amount, 0);
  const income = transactions
    .filter((t) => t.isIncome)
    .reduce((sum, t) => sum + t.amount, 0);
  return { expenses, income };
}

/**
 * Group transactions by day for the last N days.
 */
export function spendingByDay(transactions, days = 7) {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayTotal = transactions
      .filter((t) => t.isExpense && t.date && new Date(t.date).toISOString().slice(0, 10) === dayStr)
      .reduce((sum, t) => sum + t.amount, 0);
    result.push({ day: dayStr, total: dayTotal });
  }
  return result;
}

/**
 * Monthly totals for the last N months.
 */
export function spendingByMonth(transactions, months = 6) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    const filtered = filterByMonth(transactions, month, year);
    const { expenses, income } = totals(filtered);
    result.push({
      label: d.toLocaleString('default', { month: 'short' }),
      expenses,
      income,
    });
  }
  return result;
}
