import { getDb } from './db';
import { KEYWORD_MAP, KENYAN_BUSINESS_PATTERNS } from '../constants/keywordMap';

const AUTO_THRESHOLD = 3;
const BUSINESS_THRESHOLD = 2; // lower threshold for known Kenyan business name patterns

/**
 * Normalize a party/merchant name for consistent matching.
 * Strips whitespace, lowercases, and removes trailing phone numbers.
 */
export function normalizeParty(party) {
  if (!party) return null;
  return party
    .toLowerCase()
    .replace(/\d{10,}/g, '')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

/**
 * Check if a normalised party name matches a known Kenyan business pattern.
 * These patterns indicate the party is likely a real merchant, so we can
 * use a lower auto-learn threshold.
 */
export function isKnownBusinessPattern(normalisedParty) {
  if (!normalisedParty) return false;
  return KENYAN_BUSINESS_PATTERNS.some((re) => re.test(normalisedParty));
}

/**
 * Pre-match a normalised party name against the keyword map.
 * Returns the matching category ID, or null if no keyword matches.
 *
 * Keywords are checked longest-first so that more specific entries
 * (e.g. "uber eats" → FOOD) win over shorter ones ("uber" → TRANSPORT).
 */
export function keywordMatch(normalisedParty) {
  if (!normalisedParty) return null;

  // Sort keywords longest-first for specificity
  const sortedKeys = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);
  for (const keyword of sortedKeys) {
    if (normalisedParty.includes(keyword)) {
      return KEYWORD_MAP[keyword];
    }
  }
  return null;
}

/**
 * Get stored category patterns from SQLite.
 * Reconstructs the { expense: { party: { category: count } }, income: { ... } } shape.
 */
export async function getPatterns() {
  try {
    const db = getDb();
    const rows = db.getAllSync(
      'SELECT kind, party, category, count FROM category_patterns'
    );

    const result = { expense: {}, income: {} };
    for (const row of rows) {
      const bucket = result[row.kind] || {};
      const entry = bucket[row.party] || {};
      entry[row.category] = row.count;
      bucket[row.party] = entry;
      result[row.kind] = bucket;
    }
    return result;
  } catch {
    return { expense: {}, income: {} };
  }
}

/**
 * Record a user categorisation so the app can learn the pattern.
 * Uses INSERT … ON CONFLICT … DO UPDATE to upsert the count atomically.
 * @param {string} party - merchant / sender name from parsed transaction
 * @param {string} categoryOrSource - the category ID or income source ID chosen
 * @param {'expense'|'income'} kind - whether this is an expense category or income source
 */
export async function recordCategorization(party, categoryOrSource, kind = 'expense') {
  const key = normalizeParty(party);
  if (!key || !categoryOrSource) return;

  const db = getDb();
  db.runSync(
    `INSERT INTO category_patterns (kind, party, category, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(kind, party, category) DO UPDATE SET count = count + 1`,
    [kind, key, categoryOrSource]
  );
}

/**
 * Predict the category for a party name based on learned patterns.
 * First checks the keyword map for an instant match, then falls back
 * to frequency-based prediction.
 *
 * For frequency prediction, the threshold is:
 *   - 2 if the party matches a known Kenyan business name pattern
 *   - 3 otherwise (the original default)
 *
 * Returns the category ID if the top choice has been selected >= threshold
 * times AND has a clear majority (more than any other choice). Otherwise null.
 */
export async function predictCategory(party, kind = 'expense') {
  const key = normalizeParty(party);
  if (!key) return null;

  // 1️⃣ Keyword pre-match (instant, no learning data needed)
  if (kind === 'expense') {
    const kwMatch = keywordMatch(key);
    if (kwMatch) return kwMatch;
  }

  // 2️⃣ Frequency-based prediction from SQLite
  const db = getDb();
  const rows = db.getAllSync(
    `SELECT category, count FROM category_patterns
     WHERE kind = ? AND party = ?
     ORDER BY count DESC`,
    [kind, key]
  );

  if (!rows || rows.length === 0) return null;

  const bestCount = rows[0].count;
  const best = rows[0].category;
  const secondCount = rows.length > 1 ? rows[1].count : 0;

  // Determine threshold: lower for known business patterns
  const threshold = isKnownBusinessPattern(key) ? BUSINESS_THRESHOLD : AUTO_THRESHOLD;

  if (best && bestCount >= threshold && bestCount > secondCount) {
    return best;
  }
  return null;
}

/**
 * Return the user's most-used categories for the given kind,
 * sorted by total frequency (descending).
 *
 * @param {'expense'|'income'} kind - expense or income
 * @param {number} [limit=3] - how many top categories to return
 * @returns {Promise<string[]>} - array of category IDs, most-used first
 */
export async function getTopCategories(kind = 'expense', limit = 3) {
  try {
    const db = getDb();
    const rows = db.getAllSync(
      `SELECT category, SUM(count) as total
       FROM category_patterns
       WHERE kind = ?
       GROUP BY category
       ORDER BY total DESC
       LIMIT ?`,
      [kind, limit]
    );
    return rows.map((r) => r.category);
  } catch {
    return [];
  }
}

/**
 * Reset all learned category patterns.
 * Intended for use in a settings / debug screen.
 */
export async function resetPatterns() {
  const db = getDb();
  db.execSync('DELETE FROM category_patterns');
}

/**
 * Apply learned patterns to a parsed transaction.
 * Fills in category (for expenses) or incomeSource (for income) if the
 * parser left them empty and the learning engine has a confident prediction.
 * Returns the (possibly updated) transaction — never mutates the original.
 */
export async function applyLearnedCategory(transaction) {
  if (!transaction || !transaction.party) return transaction;

  // Expense: fill category if not already set
  if (transaction.isExpense && !transaction.category) {
    const predicted = await predictCategory(transaction.party, 'expense');
    if (predicted) {
      return { ...transaction, category: predicted, categorized: true };
    }
  }

  // Income: fill incomeSource if null
  if (transaction.isIncome && transaction.incomeSource === null) {
    const predicted = await predictCategory(transaction.party, 'income');
    if (predicted) {
      return { ...transaction, incomeSource: predicted };
    }
  }

  return transaction;
}
