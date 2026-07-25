import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIES } from '../constants/categories';
import SummaryCard from '../components/SummaryCard';
import TransactionCard from '../components/TransactionCard';
import CategoryModal from '../components/CategoryModal';
import IncomeModal from '../components/IncomeModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import {
  updateTransaction,
  deleteTransaction,
  filterByMonth,
  sumByCategory,
  totals,
  migrateFromAsyncStorage,
} from '../utils/storage';
import { getCachedTransactions, invalidateCache } from '../utils/analyticsCache';
import { initDb } from '../utils/db';
import { requestSmsPermissions, readExistingSms } from '../utils/smsReader';
import { recordCategorization } from '../utils/categoryLearning';
import { format } from 'date-fns';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function HomeScreen() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [smsPermission, setSmsPermission] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  const now = new Date();
  const monthLabel = format(now, 'MMMM yyyy');

  const load = useCallback(async () => {
    const all = await getCachedTransactions();
    setTransactions(all);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ── Bootstrap: initialise SQLite and migrate AsyncStorage on first launch ──
  useEffect(() => {
    (async () => {
      try {
        initDb();
        await migrateFromAsyncStorage();
      } catch (e) {
        console.error('DB init/migration error:', e);
      }
      // Load transactions after DB is ready
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SMS permissions + initial inbox scan ─────────────────────────────────
  useEffect(() => {
    (async () => {
      const granted = await requestSmsPermissions();
      setSmsPermission(granted);
      if (granted) {
        const newTxs = await readExistingSms(200, setSyncProgress);
        setSyncProgress(null);
        if (newTxs.length > 0) {
          await invalidateCache();
          load();
        }
      }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (smsPermission) {
      await readExistingSms(200, setSyncProgress);
      setSyncProgress(null);
    }
    await invalidateCache();
    await load();
    setRefreshing(false);
  }, [smsPermission, load]);

  const monthlyTxs = filterByMonth(transactions, now.getMonth(), now.getFullYear());
  const { income, expenses } = totals(monthlyTxs);
  const categoryTotals = sumByCategory(monthlyTxs);

  // Top categories
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent transactions (last 10)
  const recent = transactions.slice(0, 10);

  // Uncategorized: expenses with no category OR income with no source
  const isUncategorised = (t) =>
    (t.isExpense && !t.category) || (t.isIncome && t.incomeSource === null);

  const uncategorized = transactions.filter(isUncategorised).length;

  // Route to the right modal depending on transaction type
  const handleCategorize = (tx) => {
    setSelectedTx(tx);
    if (tx.isIncome) {
      setShowIncomeModal(true);
    } else {
      setShowCategoryModal(true);
    }
  };

  // Called when user picks an expense category
  const handleCategorySelect = async (tx, categoryId, note) => {
    await updateTransaction(tx.id, { category: categoryId, categorized: true, note });
    if (tx.party) recordCategorization(tx.party, categoryId, 'expense');
    setShowCategoryModal(false);
    setSelectedTx(null);
    await invalidateCache();
    load();
  };

  // Called when user picks an income source
  const handleIncomeSourceSelect = async (tx, sourceId, note) => {
    await updateTransaction(tx.id, { incomeSource: sourceId, note });
    if (tx.party) recordCategorization(tx.party, sourceId, 'income');
    setShowIncomeModal(false);
    setSelectedTx(null);
    await invalidateCache();
    load();
  };

  const handleDeleteTransaction = async (id) => {
    await deleteTransaction(id);
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>M-Pesa Tracker</Text>
            <Text style={styles.dateText}>{format(now, 'EEEE, d MMMM yyyy')}</Text>
          </View>
          {uncategorized > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{uncategorized}</Text>
            </View>
          )}
        </View>

        {/* Summary card */}
        <View style={styles.section}>
          <SummaryCard income={income} expenses={expenses} period={monthLabel} />
        </View>

        {/* SMS permission notice */}
        {Platform.OS === 'android' && !smsPermission && (
          <TouchableOpacity
            style={styles.permissionBanner}
            onPress={async () => {
              const granted = await requestSmsPermissions();
              setSmsPermission(granted);
            }}
          >
            <Text style={styles.permissionText}>
              📩 Tap to grant SMS access for auto-import
            </Text>
          </TouchableOpacity>
        )}

        {syncProgress && smsPermission && (
          <Text style={styles.syncText}>
            Syncing... {syncProgress.processed}/{syncProgress.total}
          </Text>
        )}

        {/* Spending categories */}
        {topCategories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending Categories</Text>
            {topCategories.map(([catId, total]) => {
              const cat = CATEGORIES[catId];
              if (!cat) return null;
              const pct = expenses > 0 ? Math.min((total / expenses) * 100, 100) : 0;
              return (
                <View key={catId} style={styles.catRow}>
                  <Text style={styles.catEmoji}>{cat.icon}</Text>
                  <View style={styles.catInfo}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catLabel}>{cat.label}</Text>
                      <Text style={styles.catAmount}>{formatKes(total)}</Text>
                    </View>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Transaction count summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{monthlyTxs.filter((t) => t.isExpense).length}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{monthlyTxs.filter((t) => t.isIncome).length}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{uncategorized}</Text>
            <Text style={styles.statLabel}>Uncategorised</Text>
          </View>
        </View>

        {/* Recent transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>
                {Platform.OS === 'android'
                  ? 'Pull down to sync your M-Pesa messages.'
                  : 'Transactions from your M-Pesa SMS will appear here.'}
              </Text>
            </View>
          ) : (
            recent.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onPress={setSelectedDetail}
                onCategorize={handleCategorize}
              />
            ))
          )}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <TransactionDetailModal
        visible={selectedDetail !== null}
        transaction={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        onCategorize={handleCategorize}
        onDelete={handleDeleteTransaction}
      />

      <CategoryModal
        visible={showCategoryModal}
        transaction={selectedTx}
        onSelect={handleCategorySelect}
        onClose={() => {
          setShowCategoryModal(false);
          setSelectedTx(null);
        }}
      />

      <IncomeModal
        visible={showIncomeModal}
        transaction={selectedTx}
        onSelect={handleIncomeSourceSelect}
        onClose={() => {
          setShowIncomeModal(false);
          setSelectedTx(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  greeting: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  permissionBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: `${COLORS.warning}20`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.warning}40`,
  },
  permissionText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  catEmoji: {
    fontSize: 22,
    marginRight: SPACING.sm,
  },
  catInfo: {
    flex: 1,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  catAmount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  barBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
  syncText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
});
