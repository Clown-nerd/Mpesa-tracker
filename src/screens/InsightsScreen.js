import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BarChartSimple from '../components/charts/BarChartSimple';
import LineChartSimple from '../components/charts/LineChartSimple';
import PieChartSimple from '../components/charts/PieChartSimple';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIES, INCOME_SOURCES } from '../constants/categories';
import {
  filterByMonth,
  sumByCategory,
  totals,
  spendingByMonth,
  spendingByDay,
} from '../utils/storage';
import { getCachedTransactions } from '../utils/analyticsCache';
import { format, subMonths } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.md * 2;


function formatKes(amount) {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return `${Math.round(amount)}`;
}

export default function InsightsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [targetDate, setTargetDate] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      getCachedTransactions().then(setTransactions);
    }, [])
  );

  const monthLabel = format(targetDate, 'MMMM yyyy');

  // ─── Memoised per-month slice ────────────────────────────────────────────────
  const monthlyTxs = useMemo(
    () => filterByMonth(transactions, targetDate.getMonth(), targetDate.getFullYear()),
    [transactions, targetDate]
  );

  const { income, expenses } = totals(monthlyTxs);

  // ─── Memoised category totals ────────────────────────────────────────────────
  const categoryTotals = useMemo(() => sumByCategory(monthlyTxs), [monthlyTxs]);

  // ─── Monthly trend data (last 6 months) — memoised ──────────────────────────
  const monthlyData = useMemo(() => spendingByMonth(transactions, 6), [transactions]);
  const lineLabels = monthlyData.map((m) => m.label);
  const lineDataExpenses = monthlyData.map((m) => m.expenses);
  const lineDataIncome = monthlyData.map((m) => m.income);

  // ─── Category pie data ───────────────────────────────────────────────────────
  const pieData = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([catId, value]) => {
      const cat = CATEGORIES[catId] || CATEGORIES.OTHER;
      return {
        name: cat.label,
        population: value,
        color: cat.color,
        legendFontColor: COLORS.text,
        legendFontSize: FONT_SIZES.xs,
      };
    });

  // ─── Daily spending (last 7 days) — memoised ────────────────────────────────
  const dailyData = useMemo(() => spendingByDay(transactions, 7), [transactions]);
  const barLabels = dailyData.map((d) => format(new Date(d.day), 'EEE'));
  const barValues = dailyData.map((d) => d.total);

  // ─── Income sources data ─────────────────────────────────────────────────────
  const incomeTotals = {};
  monthlyTxs
    .filter(t => t.isIncome && t.incomeSource)
    .forEach(t => {
      incomeTotals[t.incomeSource] = (incomeTotals[t.incomeSource] || 0) + t.amount;
    });

  const incomeData = Object.entries(incomeTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([sourceId, amount]) => {
      const source = INCOME_SOURCES[sourceId] || INCOME_SOURCES.OTHER_INCOME;
      return { sourceId, amount, ...source };
    });

  // ─── Month selector ──────────────────────────────────────────────────────────
  const months = Array.from({ length: 12 }).map((_, i) => subMonths(new Date(), i));

  const topCats = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const netSavings = income - expenses;
  const isPositive = netSavings >= 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthSelectorScroll} contentContainerStyle={styles.monthSelector}>
        {months.map((m) => {
          const isActive = m.getMonth() === targetDate.getMonth() && m.getFullYear() === targetDate.getFullYear();
          return (
            <TouchableOpacity
              key={m.toISOString()}
              style={[styles.monthBtn, isActive && styles.monthBtnActive]}
              onPress={() => setTargetDate(m)}
            >
              <Text style={[styles.monthBtnText, isActive && styles.monthBtnTextActive]}>
                {format(m, 'MMM yy')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Net savings line */}
      <View style={styles.netSavingsContainer}>
        <Text style={[styles.netSavingsText, { color: isPositive ? COLORS.income : COLORS.expense }]}>
          {isPositive ? 'Saved this month:' : 'Deficit:'} KES {Math.abs(netSavings).toLocaleString()}
        </Text>
      </View>

      {/* Income vs Expenses summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.income }]}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: COLORS.income }]}>
            KES {income.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.expense }]}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryValue, { color: COLORS.expense }]}>
            KES {expenses.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Daily spending bar chart */}
      {barValues.some((v) => v > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Spending (Last 7 Days)</Text>
          <BarChartSimple
            data={dailyData.map((d) => ({
              label: format(new Date(d.day), 'EEE'),
              value: d.total,
            }))}
            width={CHART_WIDTH - SPACING.md * 2}
            height={180}
            color={COLORS.primary}
          />
        </View>
      )}

      {/* 6-month trend line chart */}
      {lineDataExpenses.some((v) => v > 0) && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>6-Month Spending Trend</Text>
          <LineChartSimple
            datasets={[
              { data: lineDataExpenses, color: COLORS.expense, label: 'Expenses' },
              { data: lineDataIncome, color: COLORS.income, label: 'Income' },
            ]}
            labels={lineLabels}
            width={CHART_WIDTH - SPACING.md * 2}
            height={200}
          />
        </View>
      )}

      {/* Category pie chart */}
      {pieData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Spending by Category — {monthLabel}</Text>
          <PieChartSimple
            data={pieData}
            size={Math.min(CHART_WIDTH - SPACING.md * 2, 260)}
          />
        </View>
      )}

      {/* Top categories */}
      {topCats.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Top Categories — {monthLabel}</Text>
          {topCats.map(([catId, amount]) => {
            const cat = CATEGORIES[catId] || CATEGORIES.OTHER;
            const pct = expenses > 0 ? (amount / expenses) * 100 : 0;
            return (
              <View key={catId} style={styles.topCatRow}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.topCatName}>{cat.icon} {cat.label}</Text>
                <Text style={styles.topCatPct}>{pct.toFixed(0)}%</Text>
                <Text style={styles.topCatAmt}>KES {amount.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Income Sources */}
      {incomeData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Income Sources — {monthLabel}</Text>
          {incomeData.map(({ sourceId, amount, label, icon, color }) => {
            const pct = income > 0 ? (amount / income) * 100 : 0;
            return (
              <View key={sourceId} style={styles.topCatRow}>
                <View style={[styles.catDot, { backgroundColor: color }]} />
                <Text style={styles.topCatName}>{icon} {label}</Text>
                <Text style={styles.topCatPct}>{pct.toFixed(0)}%</Text>
                <Text style={styles.topCatAmt}>KES {amount.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {monthlyTxs.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>No transactions for {monthLabel}</Text>
        </View>
      )}

      <View style={{ height: SPACING.xl }} />
    </ScrollView>
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
  monthSelectorScroll: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  monthSelector: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  netSavingsContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  netSavingsText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  monthBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  monthBtnActive: {
    backgroundColor: COLORS.primary,
  },
  monthBtnText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  monthBtnTextActive: {
    color: COLORS.white,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  chartTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  chart: {
    borderRadius: BORDER_RADIUS.md,
    marginLeft: -SPACING.sm,
  },
  topCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  topCatName: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  topCatPct: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
    width: 36,
    textAlign: 'right',
  },
  topCatAmt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
    minWidth: 90,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
