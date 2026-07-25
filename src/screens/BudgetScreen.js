import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIES, CATEGORY_LIST, DEFAULT_BUDGETS } from '../constants/categories';
import { getBudgets, saveBudgets, filterByMonth, sumByCategory } from '../utils/storage';
import { getCachedTransactions, invalidateCache } from '../utils/analyticsCache';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isOver = value > max && max > 0;
  return (
    <View style={styles.barBg}>
      <View
        style={[
          styles.barFill,
          { width: `${pct}%`, backgroundColor: isOver ? COLORS.error : color },
        ]}
      />
    </View>
  );
}

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState({});
  const [spending, setSpending] = useState({});
  const [editModal, setEditModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [editValue, setEditValue] = useState('');

  const now = new Date();

  const load = useCallback(async () => {
    const saved = await getBudgets();
    setBudgets(saved || DEFAULT_BUDGETS);
    const txs = await getCachedTransactions();
    const monthly = filterByMonth(txs, now.getMonth(), now.getFullYear());
    setSpending(sumByCategory(monthly));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openEdit = (catId) => {
    setEditCat(catId);
    setEditValue(String(budgets[catId] || 0));
    setEditModal(true);
  };

  const saveBudget = async () => {
    const amount = parseFloat(editValue.replace(/,/g, ''));
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid positive number.');
      return;
    }
    const updated = { ...budgets, [editCat]: amount };
    setBudgets(updated);
    await saveBudgets(updated);
    await invalidateCache();
    setEditModal(false);
  };

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const totalSpent = Object.values(spending).reduce((s, v) => s + (v || 0), 0);
  const overBudgetCats = CATEGORY_LIST.filter(
    (c) => budgets[c.id] > 0 && (spending[c.id] || 0) > budgets[c.id]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.subtitle}>
            {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Overview card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Monthly Budget</Text>
              <Text style={styles.overviewValue}>{formatKes(totalBudget)}</Text>
            </View>
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Spent</Text>
              <Text style={[styles.overviewValue, { color: totalSpent > totalBudget ? COLORS.error : COLORS.text }]}>
                {formatKes(totalSpent)}
              </Text>
            </View>
            <View style={styles.overviewCol}>
              <Text style={styles.overviewLabel}>Remaining</Text>
              <Text
                style={[
                  styles.overviewValue,
                  { color: totalBudget - totalSpent >= 0 ? COLORS.income : COLORS.error },
                ]}
              >
                {formatKes(Math.max(totalBudget - totalSpent, 0))}
              </Text>
            </View>
          </View>
          <ProgressBar value={totalSpent} max={totalBudget} color={COLORS.primary} />
          <Text style={styles.overviewPct}>
            {totalBudget > 0 ? `${Math.min(((totalSpent / totalBudget) * 100), 100).toFixed(0)}% used` : 'No budget set'}
          </Text>
        </View>

        {/* Over-budget warning */}
        {overBudgetCats.length > 0 && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Over Budget</Text>
            <Text style={styles.warningText}>
              {overBudgetCats.map((c) => c.label).join(', ')}
            </Text>
          </View>
        )}

        {/* Category budgets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          {CATEGORY_LIST.map((cat) => {
            const budget = budgets[cat.id] || 0;
            const spent = spending[cat.id] || 0;
            const isOver = budget > 0 && spent > budget;
            const remaining = budget - spent;

            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.catCard}
                onPress={() => openEdit(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.catTop}>
                  <View style={[styles.catIconBg, { backgroundColor: `${cat.color}20` }]}>
                    <Text style={styles.catEmoji}>{cat.icon}</Text>
                  </View>
                  <View style={styles.catDetails}>
                    <Text style={styles.catName}>{cat.label}</Text>
                    {budget > 0 ? (
                      <Text style={[styles.catRemaining, { color: isOver ? COLORS.error : COLORS.textSecondary }]}>
                        {isOver
                          ? `Over by ${formatKes(Math.abs(remaining))}`
                          : `${formatKes(remaining)} left`}
                      </Text>
                    ) : (
                      <Text style={styles.catNobudget}>Tap to set budget</Text>
                    )}
                  </View>
                  <View style={styles.catAmounts}>
                    <Text style={styles.catSpent}>{formatKes(spent)}</Text>
                    {budget > 0 && (
                      <Text style={styles.catBudget}>of {formatKes(budget)}</Text>
                    )}
                  </View>
                </View>
                {budget > 0 && (
                  <ProgressBar value={spent} max={budget} color={cat.color} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Edit budget modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {editCat && (
              <>
                <Text style={styles.modalTitle}>
                  {CATEGORIES[editCat]?.icon} {CATEGORIES[editCat]?.label}
                </Text>
                <Text style={styles.modalSubtitle}>Set monthly budget (KES)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                  selectTextOnFocus
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSave} onPress={saveBudget}>
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  overviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  overviewRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  overviewCol: {
    flex: 1,
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  overviewPct: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  barBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  warningCard: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
  },
  warningTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 4,
  },
  warningText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  section: {
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  catCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  catTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  catIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  catEmoji: {
    fontSize: 20,
  },
  catDetails: {
    flex: 1,
  },
  catName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  catRemaining: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  catNobudget: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginTop: 2,
  },
  catAmounts: {
    alignItems: 'flex-end',
  },
  catSpent: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  catBudget: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSave: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
