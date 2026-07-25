import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';

function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SummaryCard({ income = 0, expenses = 0, balance = null, period = 'This Month' }) {
  const net = income - expenses;
  return (
    <View style={styles.card}>
      <Text style={styles.period}>{period}</Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Income</Text>
          <Text style={[styles.colValue, { color: COLORS.income }]}>{formatKes(income)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.col}>
          <Text style={styles.colLabel}>Expenses</Text>
          <Text style={[styles.colValue, { color: COLORS.expense }]}>{formatKes(expenses)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.col}>
          <Text style={styles.colLabel}>Net</Text>
          <Text style={[styles.colValue, { color: net >= 0 ? COLORS.income : COLORS.expense }]}>
            {formatKes(Math.abs(net))}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  period: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  colValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
