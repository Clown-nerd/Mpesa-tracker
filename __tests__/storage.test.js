/**
 * Tests for the storage and persistence layer
 * Run with: npx jest
 */

let mockStore = {};
let mockTransactions = [];
let mockBudgets = {};
let mockSettings = {};
let mockProcessedSmsIds = [];
let mockTimeCounter = 0;

// Helper to simulate progressive SQLite datetime('now')
function getSqliteNow() {
  mockTimeCounter++;
  return new Date(1700000000000 + mockTimeCounter * 1000).toISOString();
}

const mockDb = {
  execSync: jest.fn((sql) => {
    if (sql.includes('DELETE FROM transactions')) {
      mockTransactions = [];
    } else if (sql.includes('DELETE FROM processed_sms_ids')) {
      mockProcessedSmsIds.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      mockProcessedSmsIds = mockProcessedSmsIds.slice(0, 5000);
    }
  }),

  getFirstSync: jest.fn((sql, params) => {
    if (sql.includes('SELECT id FROM transactions WHERE id = ?')) {
      const id = params[0];
      const tx = mockTransactions.find(t => t.id === id);
      return tx ? { id: tx.id } : null;
    }
    if (sql.includes('SELECT id FROM transactions WHERE confirmationCode = ?')) {
      const code = params[0];
      const tx = mockTransactions.find(t => t.confirmationCode === code);
      return tx ? { id: tx.id } : null;
    }
    if (sql.includes('SELECT data FROM budgets WHERE id = 1')) {
      return mockBudgets.id === 1 ? { data: mockBudgets.data } : null;
    }
    if (sql.includes("SELECT value FROM settings WHERE key = 'asyncStorageMigrated'")) {
      return mockSettings['asyncStorageMigrated'] ? { value: mockSettings['asyncStorageMigrated'] } : null;
    }
    return null;
  }),

  getAllSync: jest.fn((sql, params) => {
    if (sql.includes('SELECT * FROM transactions')) {
      return [...mockTransactions].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA - dateB !== 0) return dateB - dateA;
        const createA = new Date(a.createdAt);
        const createB = new Date(b.createdAt);
        return createB - createA;
      });
    }
    if (sql.includes('SELECT sms_id FROM processed_sms_ids')) {
      return mockProcessedSmsIds.map(row => ({ sms_id: row.sms_id }));
    }
    if (sql.includes('SELECT key, value FROM settings')) {
      return Object.entries(mockSettings).map(([key, value]) => ({ key, value }));
    }
    return [];
  }),

  runSync: jest.fn((sql, params) => {
    if (sql.includes('INTO transactions')) {
      const row = {
        id: params.$id,
        confirmationCode: params.$confirmationCode,
        type: params.$type,
        amount: params.$amount,
        party: params.$party,
        accountNumber: params.$accountNumber,
        paybillNumber: params.$paybillNumber,
        date: params.$date,
        rawMessage: params.$rawMessage,
        isExpense: params.$isExpense,
        isIncome: params.$isIncome,
        balance: params.$balance,
        category: params.$category,
        categorized: params.$categorized,
        incomeSource: params.$incomeSource,
        note: params.$note,
        createdAt: params.$createdAt,
      };
      if (sql.includes('IGNORE') && mockTransactions.some(t => t.id === row.id)) {
        return { changes: 0 };
      }
      mockTransactions.push(row);
      return { changes: 1 };
    }
    if (sql.includes('UPDATE transactions SET')) {
      const id = params.$id;
      const tx = mockTransactions.find(t => t.id === id);
      if (!tx) {
        return { changes: 0 };
      }
      for (const [paramKey, val] of Object.entries(params)) {
        if (paramKey.startsWith('$') && paramKey !== '$id') {
          const field = paramKey.slice(1);
          tx[field] = val;
        }
      }
      return { changes: 1 };
    }
    if (sql.includes('DELETE FROM transactions WHERE id = ?')) {
      const id = params[0];
      const initialLength = mockTransactions.length;
      mockTransactions = mockTransactions.filter(t => t.id !== id);
      return { changes: initialLength - mockTransactions.length };
    }
    if (sql.includes('INTO budgets')) {
      mockBudgets = { id: 1, data: params.$data };
      return { changes: 1 };
    }
    if (sql.includes('INTO processed_sms_ids')) {
      const smsId = params[0];
      if (!mockProcessedSmsIds.some(row => row.sms_id === smsId)) {
        mockProcessedSmsIds.push({ sms_id: smsId, created_at: getSqliteNow() });
      }
      return { changes: 1 };
    }
    if (sql.includes('INTO settings')) {
      if (sql.includes("VALUES ('asyncStorageMigrated', 'true')")) {
        mockSettings['asyncStorageMigrated'] = 'true';
        return { changes: 1 };
      }
      const key = params.$key;
      const value = params.$value;
      mockSettings[key] = value;
      return { changes: 1 };
    }
    return { changes: 0 };
  }),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDb),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key) => Promise.resolve(mockStore[key] || null)),
    setItem: jest.fn((key, value) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

const {
  saveTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  clearAllTransactions,
  saveBudgets,
  getBudgets,
  getProcessedSmsIds,
  addProcessedSmsId,
  getSettings,
  saveSettings,
  migrateFromAsyncStorage,
  filterByMonth,
  sumByCategory,
  totals,
  spendingByDay,
} = require('../src/utils/storage');

beforeEach(() => {
  mockStore = {};
  mockTransactions = [];
  mockBudgets = {};
  mockSettings = {};
  mockProcessedSmsIds = [];
  mockTimeCounter = 0;
});

// ─── saveTransaction ────────────────────────────────────────────────────────

describe('saveTransaction', () => {
  test('saves correctly', async () => {
    const tx = {
      id: 'tx-1',
      confirmationCode: 'XYZ123',
      type: 'SENT',
      amount: 1500,
      party: 'KPLC PREPAID',
      date: new Date('2026-05-28T12:00:00Z'),
      isExpense: true,
      isIncome: false,
      balance: 500,
      category: 'ELECTRICITY',
      categorized: true,
      createdAt: new Date('2026-05-28T12:00:00Z'),
    };

    const res = await saveTransaction(tx);
    expect(res).toBe(true);
    expect(mockTransactions.length).toBe(1);
    expect(mockTransactions[0].id).toBe('tx-1');
    expect(mockTransactions[0].confirmationCode).toBe('XYZ123');
    expect(mockTransactions[0].amount).toBe(1500);
  });

  test('rejects duplicate id', async () => {
    const tx1 = {
      id: 'tx-dup-id',
      confirmationCode: 'ABC001',
      amount: 100,
      date: new Date(),
    };
    const tx2 = {
      id: 'tx-dup-id',
      confirmationCode: 'ABC002',
      amount: 200,
      date: new Date(),
    };

    const res1 = await saveTransaction(tx1);
    expect(res1).toBe(true);

    const res2 = await saveTransaction(tx2);
    expect(res2).toBe(false);
    expect(mockTransactions.length).toBe(1);
  });

  test('rejects duplicate confirmationCode', async () => {
    const tx1 = {
      id: 'tx-1',
      confirmationCode: 'DUPCODE',
      amount: 100,
      date: new Date(),
    };
    const tx2 = {
      id: 'tx-2',
      confirmationCode: 'DUPCODE',
      amount: 200,
      date: new Date(),
    };

    const res1 = await saveTransaction(tx1);
    expect(res1).toBe(true);

    const res2 = await saveTransaction(tx2);
    expect(res2).toBe(false);
    expect(mockTransactions.length).toBe(1);
  });
});

// ─── getTransactions ────────────────────────────────────────────────────────

describe('getTransactions', () => {
  test('returns [] when empty', async () => {
    const txs = await getTransactions();
    expect(txs).toEqual([]);
  });

  test('returns array with Date objects (not strings) when populated', async () => {
    const tx = {
      id: 'tx-1',
      confirmationCode: 'ABC123',
      amount: 500,
      date: new Date('2026-05-28T12:00:00Z'),
      createdAt: new Date('2026-05-28T12:00:00Z'),
    };
    await saveTransaction(tx);

    const txs = await getTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].id).toBe('tx-1');
    expect(txs[0].date).toBeInstanceOf(Date);
    expect(txs[0].createdAt).toBeInstanceOf(Date);
    expect(txs[0].date.toISOString()).toBe(tx.date.toISOString());
  });
});

// ─── updateTransaction ─────────────────────────────────────────────────────

describe('updateTransaction', () => {
  test('updates a field', async () => {
    const tx = {
      id: 'tx-1',
      confirmationCode: 'ABC123',
      amount: 500,
      date: new Date(),
      category: null,
      categorized: false,
    };
    await saveTransaction(tx);

    const updated = await updateTransaction('tx-1', {
      category: 'FOOD',
      categorized: true,
    });
    expect(updated).toBe(true);

    const txs = await getTransactions();
    expect(txs[0].category).toBe('FOOD');
    expect(txs[0].categorized).toBe(true);
  });

  test('returns false for unknown id', async () => {
    const updated = await updateTransaction('unknown-id', {
      category: 'FOOD',
    });
    expect(updated).toBe(false);
  });
});

// ─── deleteTransaction ────────────────────────────────────────────────────────

describe('deleteTransaction', () => {
  test('deletes an existing transaction by id', async () => {
    const tx = {
      id: 'tx-1',
      confirmationCode: 'ABC123',
      amount: 500,
      date: new Date(),
    };
    await saveTransaction(tx);

    const deleted = await deleteTransaction('tx-1');
    expect(deleted).toBe(true);

    const txs = await getTransactions();
    expect(txs.length).toBe(0);
  });

  test('returns true even if ID does not exist', async () => {
    const deleted = await deleteTransaction('non-existent');
    expect(deleted).toBe(true);
  });
});

// ─── clearAllTransactions ───────────────────────────────────────────────────

describe('clearAllTransactions', () => {
  test('wipes all transactions', async () => {
    await saveTransaction({ id: 'tx-1', amount: 100, date: new Date() });
    await saveTransaction({ id: 'tx-2', amount: 200, date: new Date() });

    const cleared = await clearAllTransactions();
    expect(cleared).toBe(true);

    const txs = await getTransactions();
    expect(txs.length).toBe(0);
  });
});

// ─── budgets ─────────────────────────────────────────────────────────────────

describe('budgets', () => {
  test('returns null when no budgets are saved', async () => {
    const budgets = await getBudgets();
    expect(budgets).toBeNull();
  });

  test('saves and retrieves budgets correctly', async () => {
    const data = { FOOD: 15000, TRANSPORT: 5000 };
    const saved = await saveBudgets(data);
    expect(saved).toBe(true);

    const budgets = await getBudgets();
    expect(budgets).toEqual(data);
  });
});

// ─── settings ────────────────────────────────────────────────────────────────

describe('settings', () => {
  test('returns default settings when none are saved', async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      currency: 'KES',
      theme: 'light',
      notifyOnNew: true,
    });
  });

  test('saves and retrieves settings correctly', async () => {
    const updates = { currency: 'USD', theme: 'dark' };
    const saved = await saveSettings(updates);
    expect(saved).toBe(true);

    const settings = await getSettings();
    expect(settings).toEqual({
      currency: 'USD',
      theme: 'dark',
      notifyOnNew: true,
    });
  });
});

// ─── migrateFromAsyncStorage ─────────────────────────────────────────────────

describe('migrateFromAsyncStorage', () => {
  test('migrates all data from AsyncStorage to SQLite and clears AsyncStorage keys', async () => {
    const oldTransactions = [
      { id: 'tx-old-1', confirmationCode: 'OLD1', amount: 1000, date: '2026-05-01T10:00:00.000Z', isExpense: true },
      { id: 'tx-old-2', confirmationCode: 'OLD2', amount: 2000, date: '2026-05-02T10:00:00.000Z', isIncome: true },
    ];
    const oldBudgets = { FOOD: 20000 };
    const oldSettings = { theme: 'dark', currency: 'KES' };
    const oldProcessedSms = ['sms-old-1', 'sms-old-2'];

    mockStore['@mpesa_tracker:transactions'] = JSON.stringify(oldTransactions);
    mockStore['@mpesa_tracker:budgets'] = JSON.stringify(oldBudgets);
    mockStore['@mpesa_tracker:settings'] = JSON.stringify(oldSettings);
    mockStore['@mpesa_tracker:processed_sms'] = JSON.stringify(oldProcessedSms);

    await migrateFromAsyncStorage();

    const txs = await getTransactions();
    expect(txs.length).toBe(2);
    expect(txs.map(t => t.id)).toContain('tx-old-1');
    expect(txs.map(t => t.id)).toContain('tx-old-2');

    const budgets = await getBudgets();
    expect(budgets).toEqual(oldBudgets);

    const settings = await getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.asyncStorageMigrated).toBe(true);

    const processedSms = await getProcessedSmsIds();
    expect(processedSms.sort()).toEqual(['sms-old-1', 'sms-old-2']);

    expect(mockStore['@mpesa_tracker:transactions']).toBeUndefined();
    expect(mockStore['@mpesa_tracker:budgets']).toBeUndefined();
    expect(mockStore['@mpesa_tracker:settings']).toBeUndefined();
    expect(mockStore['@mpesa_tracker:processed_sms']).toBeUndefined();
  });

  test('does not run migration again if asyncStorageMigrated sentinel is present', async () => {
    mockSettings['asyncStorageMigrated'] = 'true';

    const oldTransactions = [{ id: 'tx-old-1', amount: 1000 }];
    mockStore['@mpesa_tracker:transactions'] = JSON.stringify(oldTransactions);

    await migrateFromAsyncStorage();

    const txs = await getTransactions();
    expect(txs.length).toBe(0);
    expect(mockStore['@mpesa_tracker:transactions']).toBeDefined();
  });
});

// ─── filterByMonth ──────────────────────────────────────────────────────────

describe('filterByMonth', () => {
  test('filters correctly', () => {
    const t1 = { date: new Date('2026-05-15T10:00:00Z') };
    const t2 = { date: new Date('2026-05-20T10:00:00Z') };
    const t3 = { date: new Date('2026-06-01T10:00:00Z') };
    const list = [t1, t2, t3];

    const filtered = filterByMonth(list, 4, 2026);
    expect(filtered).toEqual([t1, t2]);
  });

  test('handles edge cases (empty array, wrong month)', () => {
    const t1 = { date: new Date('2026-05-15T10:00:00Z') };
    const list = [t1];

    expect(filterByMonth([], 4, 2026)).toEqual([]);
    expect(filterByMonth(list, 11, 2026)).toEqual([]);
  });
});

// ─── sumByCategory ──────────────────────────────────────────────────────────

describe('sumByCategory', () => {
  test('sums correctly', () => {
    const list = [
      { isExpense: true, category: 'FOOD', amount: 150 },
      { isExpense: true, category: 'FOOD', amount: 350 },
      { isExpense: true, category: 'TRANSPORT', amount: 200 },
    ];

    expect(sumByCategory(list)).toEqual({
      FOOD: 500,
      TRANSPORT: 200,
    });
  });

  test('ignores income transactions', () => {
    const list = [
      { isExpense: true, category: 'FOOD', amount: 150 },
      { isExpense: false, isIncome: true, category: 'FOOD', amount: 350 },
    ];

    expect(sumByCategory(list)).toEqual({
      FOOD: 150,
    });
  });

  test('ignores uncategorized', () => {
    const list = [
      { isExpense: true, category: 'FOOD', amount: 150 },
      { isExpense: true, category: null, amount: 350 },
      { isExpense: true, category: undefined, amount: 200 },
    ];

    expect(sumByCategory(list)).toEqual({
      FOOD: 150,
    });
  });
});

// ─── totals ─────────────────────────────────────────────────────────────────

describe('totals', () => {
  test('correct income/expense split', () => {
    const list = [
      { isExpense: true, isIncome: false, amount: 100 },
      { isExpense: true, isIncome: false, amount: 250 },
      { isExpense: false, isIncome: true, amount: 500 },
      { isExpense: false, isIncome: true, amount: 1500 },
    ];

    expect(totals(list)).toEqual({
      expenses: 350,
      income: 2000,
    });
  });
});

// ─── spendingByDay ──────────────────────────────────────────────────────────

describe('spendingByDay', () => {
  test('returns 7 entries, correct day keys', () => {
    const now = new Date();
    const expectedDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      expectedDays.push(d.toISOString().slice(0, 10));
    }

    const tToday = { isExpense: true, amount: 100, date: new Date() };
    const tYesterday = { isExpense: true, amount: 200, date: new Date(Date.now() - 86400000) };
    const tOther = { isExpense: true, amount: 300, date: new Date(Date.now() - 86400000 * 8) };

    const result = spendingByDay([tToday, tYesterday, tOther]);
    expect(result.length).toBe(7);
    expect(result.map(r => r.day)).toEqual(expectedDays);
    expect(result[6].total).toBe(100);
    expect(result[5].total).toBe(200);
    expect(result[0].total).toBe(0);
  });
});

// ─── addProcessedSmsId ──────────────────────────────────────────────────────

describe('addProcessedSmsId', () => {
  test('deduplicates', async () => {
    await addProcessedSmsId('sms-1');
    await addProcessedSmsId('sms-1');

    const ids = await getProcessedSmsIds();
    expect(ids).toEqual(['sms-1']);
  });

  test('caps at 5000', async () => {
    for (let i = 1; i <= 5005; i++) {
      await addProcessedSmsId(`sms-${i}`);
    }

    const ids = await getProcessedSmsIds();
    expect(ids.length).toBe(5000);
    expect(ids.includes('sms-1')).toBe(false);
    expect(ids.includes('sms-5')).toBe(false);
    expect(ids.includes('sms-6')).toBe(true);
    expect(ids.includes('sms-5005')).toBe(true);
  });
});
