/**
 * analyticsCache.js — module-level in-memory cache for transactions.
 *
 * Uses a plain JS object (no AsyncStorage or SQLite) so reads are synchronous
 * after the first fetch. The 30-second TTL prevents stale data from lingering
 * while still eliminating redundant DB hits on every tab focus.
 *
 * Target: low-end Android phones with limited RAM and CPU.
 */

import { getRecentTransactions } from './storage';

// ─── Cache store ──────────────────────────────────────────────────────────────

const _cache = { transactions: null, lastUpdated: 0 };
const CACHE_TTL_MS = 30000; // 30 seconds

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return cached transactions if the cache is fresh (< 30 s old).
 * Otherwise fetch from SQLite, update the cache, and return the result.
 *
 * HomeScreen uses getRecentTransactions (limit 50) for the fast path so the
 * initial render is cheap on devices with thousands of stored messages.
 */
export async function getCachedTransactions() {
  const now = Date.now();
  if (_cache.transactions !== null && now - _cache.lastUpdated < CACHE_TTL_MS) {
    return _cache.transactions;
  }

  const fresh = await getRecentTransactions(50);
  _cache.transactions = fresh;
  _cache.lastUpdated = Date.now();
  return fresh;
}

/**
 * Force the next getCachedTransactions() call to hit the database.
 * Call this whenever data is known to have changed (new SMS, category update,
 * budget save, manual refresh, etc.).
 */
export async function invalidateCache() {
  _cache.transactions = null;
  _cache.lastUpdated = 0;
}
