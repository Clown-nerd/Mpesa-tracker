/**
 * Tests for the category learning engine
 * Run with: npx jest
 */

// ─── In-memory SQLite mock (same pattern as storage.test.js) ─────────────────

let mockCategoryPatterns = []; // [{ kind, party, category, count }]

const mockDb = {
  execSync: jest.fn((sql) => {
    if (sql.includes('DELETE FROM category_patterns')) {
      mockCategoryPatterns = [];
    }
  }),

  getAllSync: jest.fn((sql, params) => {
    if (sql.includes('FROM category_patterns') && sql.includes('SUM(count)')) {
      // getTopCategories query
      const kind = params[0];
      const limit = params[1];
      const totals = {};
      for (const row of mockCategoryPatterns) {
        if (row.kind === kind) {
          totals[row.category] = (totals[row.category] || 0) + row.count;
        }
      }
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([category, total]) => ({ category, total }));
    }
    if (sql.includes('FROM category_patterns') && sql.includes('ORDER BY count DESC')) {
      // predictCategory query: WHERE kind = ? AND party = ?
      const kind = params[0];
      const party = params[1];
      return mockCategoryPatterns
        .filter((r) => r.kind === kind && r.party === party)
        .sort((a, b) => b.count - a.count);
    }
    if (sql.includes('FROM category_patterns')) {
      // getPatterns() — no WHERE clause
      return [...mockCategoryPatterns];
    }
    return [];
  }),

  runSync: jest.fn((sql, params) => {
    if (
      sql.includes('INTO category_patterns') &&
      sql.includes('ON CONFLICT') &&
      sql.includes('count + 1')
    ) {
      // recordCategorization upsert
      const [kind, party, category] = params;
      const existing = mockCategoryPatterns.find(
        (r) => r.kind === kind && r.party === party && r.category === category
      );
      if (existing) {
        existing.count += 1;
      } else {
        mockCategoryPatterns.push({ kind, party, category, count: 1 });
      }
      return { changes: 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO category_patterns')) {
      // migration upsert
      const [kind, party, category, count] = params;
      const existing = mockCategoryPatterns.find(
        (r) => r.kind === kind && r.party === party && r.category === category
      );
      if (!existing) {
        mockCategoryPatterns.push({ kind, party, category, count });
      }
      return { changes: existing ? 0 : 1 };
    }
    return { changes: 0 };
  }),

  getFirstSync: jest.fn(() => null),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDb),
}));

const {
  normalizeParty,
  getPatterns,
  recordCategorization,
  predictCategory,
  applyLearnedCategory,
  keywordMatch,
  isKnownBusinessPattern,
  getTopCategories,
  resetPatterns,
} = require('../src/utils/categoryLearning');

beforeEach(() => {
  mockCategoryPatterns = [];
  jest.clearAllMocks();
  // Re-attach the implementations after clearAllMocks
  mockDb.execSync.mockImplementation((sql) => {
    if (sql.includes('DELETE FROM category_patterns')) {
      mockCategoryPatterns = [];
    }
  });
  mockDb.getAllSync.mockImplementation((sql, params) => {
    if (sql.includes('FROM category_patterns') && sql.includes('SUM(count)')) {
      const kind = params[0];
      const limit = params[1];
      const totals = {};
      for (const row of mockCategoryPatterns) {
        if (row.kind === kind) {
          totals[row.category] = (totals[row.category] || 0) + row.count;
        }
      }
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([category, total]) => ({ category, total }));
    }
    if (sql.includes('FROM category_patterns') && sql.includes('ORDER BY count DESC')) {
      const kind = params[0];
      const party = params[1];
      return mockCategoryPatterns
        .filter((r) => r.kind === kind && r.party === party)
        .sort((a, b) => b.count - a.count);
    }
    if (sql.includes('FROM category_patterns')) {
      return [...mockCategoryPatterns];
    }
    return [];
  });
  mockDb.runSync.mockImplementation((sql, params) => {
    if (
      sql.includes('INTO category_patterns') &&
      sql.includes('ON CONFLICT') &&
      sql.includes('count + 1')
    ) {
      const [kind, party, category] = params;
      const existing = mockCategoryPatterns.find(
        (r) => r.kind === kind && r.party === party && r.category === category
      );
      if (existing) {
        existing.count += 1;
      } else {
        mockCategoryPatterns.push({ kind, party, category, count: 1 });
      }
      return { changes: 1 };
    }
    if (sql.includes('INSERT OR IGNORE INTO category_patterns')) {
      const [kind, party, category, count] = params;
      const existing = mockCategoryPatterns.find(
        (r) => r.kind === kind && r.party === party && r.category === category
      );
      if (!existing) {
        mockCategoryPatterns.push({ kind, party, category, count });
      }
      return { changes: existing ? 0 : 1 };
    }
    return { changes: 0 };
  });
  mockDb.getFirstSync.mockReturnValue(null);
});

// ─── normalizeParty ──────────────────────────────────────────────────────────

describe('normalizeParty', () => {
  test('lowercases and trims', () => {
    expect(normalizeParty('  KPLC PREPAID  ')).toBe('kplc prepaid');
  });

  test('strips phone numbers', () => {
    expect(normalizeParty('JOHN DOE 0712345678')).toBe('john doe');
  });

  test('collapses whitespace', () => {
    expect(normalizeParty('JAVA   HOUSE')).toBe('java house');
  });

  test('returns null for empty or null', () => {
    expect(normalizeParty(null)).toBeNull();
    expect(normalizeParty('')).toBeNull();
    expect(normalizeParty('   ')).toBeNull();
  });
});

// ─── keywordMatch ────────────────────────────────────────────────────────────

describe('keywordMatch', () => {
  test('matches known keyword exactly', () => {
    expect(keywordMatch('safaricom')).toBe('INTERNET');
    expect(keywordMatch('uber')).toBe('TRANSPORT');
    expect(keywordMatch('naivas')).toBe('FOOD');
    expect(keywordMatch('carrefour')).toBe('SHOPPING');
    expect(keywordMatch('equity')).toBe('TRANSFERS');
    expect(keywordMatch('kcb')).toBe('TRANSFERS');
  });

  test('matches keyword as substring of party name', () => {
    expect(keywordMatch('java house nairobi')).toBe('FOOD');
    expect(keywordMatch('safaricom home internet')).toBe('INTERNET');
  });

  test('specific keyword wins over generic (uber eats → FOOD not TRANSPORT)', () => {
    expect(keywordMatch('uber eats')).toBe('FOOD');
  });

  test('returns null for unknown party', () => {
    expect(keywordMatch('random merchant xyz')).toBeNull();
  });

  test('returns null for null/empty', () => {
    expect(keywordMatch(null)).toBeNull();
    expect(keywordMatch('')).toBeNull();
  });
});

// ─── isKnownBusinessPattern ──────────────────────────────────────────────────

describe('isKnownBusinessPattern', () => {
  test('matches business suffixes', () => {
    expect(isKnownBusinessPattern('acme enterprises')).toBe(true);
    expect(isKnownBusinessPattern('sunrise ltd')).toBe(true);
    expect(isKnownBusinessPattern('abc limited')).toBe(true);
    expect(isKnownBusinessPattern('city pharmacy')).toBe(true);
    expect(isKnownBusinessPattern('green hotel')).toBe(true);
  });

  test('matches Kenyan city names', () => {
    expect(isKnownBusinessPattern('nairobi bakery')).toBe(true);
    expect(isKnownBusinessPattern('mombasa traders')).toBe(true);
  });

  test('matches composite business names', () => {
    expect(isKnownBusinessPattern('acme solutions')).toBe(false); // no matching suffix or keyword
    expect(isKnownBusinessPattern('quickmart')).toBe(true); // ends with mart
  });

  test('returns false for generic person names', () => {
    expect(isKnownBusinessPattern('john doe')).toBe(false);
    expect(isKnownBusinessPattern('alice wanjiru')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isKnownBusinessPattern(null)).toBe(false);
  });
});

// ─── getPatterns ─────────────────────────────────────────────────────────────

describe('getPatterns', () => {
  test('returns empty buckets when no data stored', async () => {
    const patterns = await getPatterns();
    expect(patterns).toEqual({ expense: {}, income: {} });
  });

  test('returns stored patterns', async () => {
    mockCategoryPatterns.push({ kind: 'expense', party: 'kplc', category: 'ELECTRICITY', count: 3 });
    const patterns = await getPatterns();
    expect(patterns.expense['kplc']).toEqual({ ELECTRICITY: 3 });
  });
});

// ─── recordCategorization ────────────────────────────────────────────────────

describe('recordCategorization', () => {
  test('records an expense categorization', async () => {
    await recordCategorization('KPLC PREPAID', 'ELECTRICITY', 'expense');
    const patterns = await getPatterns();
    expect(patterns.expense['kplc prepaid']).toEqual({ ELECTRICITY: 1 });
  });

  test('increments count on repeated categorization', async () => {
    await recordCategorization('UBER', 'TRANSPORT', 'expense');
    await recordCategorization('UBER', 'TRANSPORT', 'expense');
    await recordCategorization('UBER', 'TRANSPORT', 'expense');
    const patterns = await getPatterns();
    expect(patterns.expense['uber']).toEqual({ TRANSPORT: 3 });
  });

  test('records multiple categories for same merchant', async () => {
    await recordCategorization('NAIVAS', 'FOOD', 'expense');
    await recordCategorization('NAIVAS', 'SHOPPING', 'expense');
    const patterns = await getPatterns();
    expect(patterns.expense['naivas']).toEqual({ FOOD: 1, SHOPPING: 1 });
  });

  test('records income source', async () => {
    await recordCategorization('ALICE WANJIRU', 'SALARY', 'income');
    const patterns = await getPatterns();
    expect(patterns.income['alice wanjiru']).toEqual({ SALARY: 1 });
  });

  test('ignores null party or category', async () => {
    await recordCategorization(null, 'FOOD', 'expense');
    await recordCategorization('KPLC', null, 'expense');
    const patterns = await getPatterns();
    expect(patterns).toEqual({ expense: {}, income: {} });
  });
});

// ─── predictCategory ─────────────────────────────────────────────────────────

describe('predictCategory', () => {
  test('returns null when no data', async () => {
    // For parties NOT in the keyword map
    expect(await predictCategory('RANDOM XYZ PERSON')).toBeNull();
  });

  test('returns keyword match instantly without any learned data', async () => {
    expect(await predictCategory('SAFARICOM')).toBe('INTERNET');
    expect(await predictCategory('JAVA HOUSE')).toBe('FOOD');
    expect(await predictCategory('UBER')).toBe('TRANSPORT');
    expect(await predictCategory('CARREFOUR')).toBe('SHOPPING');
  });

  test('keyword match is only for expense, not income', async () => {
    // "safaricom" is in keyword map but should not match for income kind
    expect(await predictCategory('SAFARICOM', 'income')).toBeNull();
  });

  test('returns null when count below threshold for regular party', async () => {
    // Party not in keyword map, not matching business pattern
    await recordCategorization('MAMA MBOGA', 'FOOD', 'expense');
    // only 1, threshold is 3 for non-business parties
    expect(await predictCategory('MAMA MBOGA')).toBeNull();
  });

  test('uses lower threshold (2) for known business patterns', async () => {
    // "sunrise ltd" matches KENYAN_BUSINESS_PATTERNS → threshold = 2
    await recordCategorization('SUNRISE LTD', 'FOOD', 'expense');
    await recordCategorization('SUNRISE LTD', 'FOOD', 'expense');
    expect(await predictCategory('SUNRISE LTD')).toBe('FOOD');
  });

  test('regular threshold (3) still applies for non-business parties', async () => {
    await recordCategorization('MAMA MBOGA', 'FOOD', 'expense');
    await recordCategorization('MAMA MBOGA', 'FOOD', 'expense');
    // 2 hits but no business pattern → needs 3
    expect(await predictCategory('MAMA MBOGA')).toBeNull();

    await recordCategorization('MAMA MBOGA', 'FOOD', 'expense');
    expect(await predictCategory('MAMA MBOGA')).toBe('FOOD');
  });

  test('predicts category at threshold', async () => {
    // "mary wanjiku" not in keyword map, not business pattern → threshold 3
    await recordCategorization('MARY WANJIKU', 'TRANSPORT', 'expense');
    await recordCategorization('MARY WANJIKU', 'TRANSPORT', 'expense');
    await recordCategorization('MARY WANJIKU', 'TRANSPORT', 'expense');
    expect(await predictCategory('MARY WANJIKU')).toBe('TRANSPORT');
  });

  test('predicts category above threshold', async () => {
    for (let i = 0; i < 5; i++) {
      await recordCategorization('SOME PERSON ABC', 'FOOD', 'expense');
    }
    expect(await predictCategory('SOME PERSON ABC')).toBe('FOOD');
  });

  test('returns null when there is a tie', async () => {
    // Use a party not in keyword map
    await recordCategorization('CUSTOM VENDOR A', 'FOOD', 'expense');
    await recordCategorization('CUSTOM VENDOR A', 'FOOD', 'expense');
    await recordCategorization('CUSTOM VENDOR A', 'FOOD', 'expense');
    await recordCategorization('CUSTOM VENDOR A', 'SHOPPING', 'expense');
    await recordCategorization('CUSTOM VENDOR A', 'SHOPPING', 'expense');
    await recordCategorization('CUSTOM VENDOR A', 'SHOPPING', 'expense');
    // tie at 3 each — no clear majority
    expect(await predictCategory('CUSTOM VENDOR A')).toBeNull();
  });

  test('predicts when one category has clear majority', async () => {
    for (let i = 0; i < 4; i++) {
      await recordCategorization('CUSTOM VENDOR B', 'FOOD', 'expense');
    }
    await recordCategorization('CUSTOM VENDOR B', 'SHOPPING', 'expense');
    expect(await predictCategory('CUSTOM VENDOR B')).toBe('FOOD');
  });

  test('predicts income source', async () => {
    for (let i = 0; i < 3; i++) {
      await recordCategorization('ALICE WANJIRU', 'SALARY', 'income');
    }
    expect(await predictCategory('ALICE WANJIRU', 'income')).toBe('SALARY');
  });

  test('matches party with different phone numbers', async () => {
    await recordCategorization('JOHN DOE 0712345678', 'GIG', 'income');
    await recordCategorization('JOHN DOE 0798765432', 'GIG', 'income');
    await recordCategorization('JOHN DOE', 'GIG', 'income');
    expect(await predictCategory('JOHN DOE 0711111111', 'income')).toBe('GIG');
  });
});

// ─── getTopCategories ────────────────────────────────────────────────────────

describe('getTopCategories', () => {
  test('returns empty array when no data', async () => {
    expect(await getTopCategories('expense')).toEqual([]);
  });

  test('returns categories sorted by total frequency', async () => {
    // FOOD: 5 total (3 from naivas + 2 from mama)
    await recordCategorization('NAIVAS WESTLANDS', 'FOOD', 'expense');
    await recordCategorization('NAIVAS WESTLANDS', 'FOOD', 'expense');
    await recordCategorization('NAIVAS WESTLANDS', 'FOOD', 'expense');
    await recordCategorization('MAMA KITCHEN', 'FOOD', 'expense');
    await recordCategorization('MAMA KITCHEN', 'FOOD', 'expense');

    // TRANSPORT: 3 total
    await recordCategorization('BOLT RIDE', 'TRANSPORT', 'expense');
    await recordCategorization('BOLT RIDE', 'TRANSPORT', 'expense');
    await recordCategorization('BOLT RIDE', 'TRANSPORT', 'expense');

    // SHOPPING: 1 total
    await recordCategorization('RANDOM SHOP', 'SHOPPING', 'expense');

    const top = await getTopCategories('expense', 3);
    expect(top).toEqual(['FOOD', 'TRANSPORT', 'SHOPPING']);
  });

  test('respects limit parameter', async () => {
    for (let i = 0; i < 3; i++) {
      await recordCategorization('A', 'FOOD', 'expense');
      await recordCategorization('B', 'TRANSPORT', 'expense');
      await recordCategorization('C', 'SHOPPING', 'expense');
      await recordCategorization('D', 'HEALTH', 'expense');
    }

    const top2 = await getTopCategories('expense', 2);
    expect(top2).toHaveLength(2);
  });

  test('works for income kind', async () => {
    await recordCategorization('EMPLOYER', 'SALARY', 'income');
    await recordCategorization('EMPLOYER', 'SALARY', 'income');
    await recordCategorization('FRIEND', 'GIG', 'income');

    const top = await getTopCategories('income', 2);
    expect(top[0]).toBe('SALARY');
  });
});

// ─── resetPatterns ───────────────────────────────────────────────────────────

describe('resetPatterns', () => {
  test('clears all learned patterns', async () => {
    await recordCategorization('UBER', 'TRANSPORT', 'expense');
    await recordCategorization('KPLC', 'ELECTRICITY', 'expense');

    let patterns = await getPatterns();
    expect(Object.keys(patterns.expense).length).toBeGreaterThan(0);

    await resetPatterns();

    patterns = await getPatterns();
    expect(patterns).toEqual({ expense: {}, income: {} });
  });
});

// ─── applyLearnedCategory ────────────────────────────────────────────────────

describe('applyLearnedCategory', () => {
  test('returns transaction unchanged when no party', async () => {
    const tx = { isExpense: true, category: null, party: null };
    const result = await applyLearnedCategory(tx);
    expect(result.category).toBeNull();
  });

  test('does not overwrite existing category', async () => {
    for (let i = 0; i < 5; i++) {
      await recordCategorization('KPLC', 'ELECTRICITY', 'expense');
    }
    const tx = { isExpense: true, category: 'OTHER', categorized: true, party: 'KPLC' };
    const result = await applyLearnedCategory(tx);
    expect(result.category).toBe('OTHER');
  });

  test('fills missing expense category from keyword match', async () => {
    // No learned data needed — keyword match is instant
    const tx = { isExpense: true, isIncome: false, category: null, categorized: false, party: 'UBER' };
    const result = await applyLearnedCategory(tx);
    expect(result.category).toBe('TRANSPORT');
    expect(result.categorized).toBe(true);
  });

  test('fills missing expense category from learned pattern', async () => {
    for (let i = 0; i < 3; i++) {
      await recordCategorization('CUSTOM MERCHANT', 'TRANSPORT', 'expense');
    }
    const tx = { isExpense: true, isIncome: false, category: null, categorized: false, party: 'CUSTOM MERCHANT' };
    const result = await applyLearnedCategory(tx);
    expect(result.category).toBe('TRANSPORT');
    expect(result.categorized).toBe(true);
  });

  test('fills missing income source from learned pattern', async () => {
    for (let i = 0; i < 3; i++) {
      await recordCategorization('ALICE WANJIRU', 'SALARY', 'income');
    }
    const tx = { isExpense: false, isIncome: true, incomeSource: null, party: 'ALICE WANJIRU' };
    const result = await applyLearnedCategory(tx);
    expect(result.incomeSource).toBe('SALARY');
  });

  test('returns null transaction unchanged', async () => {
    expect(await applyLearnedCategory(null)).toBeNull();
  });
});
