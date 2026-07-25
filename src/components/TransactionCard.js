import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIES, INCOME_SOURCES } from '../constants/categories';
import { format } from 'date-fns';

function formatKes(amount) {
  if (amount === undefined || amount === null) return 'KES 0.00';
  return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function typeLabel(type) {
  const map = {
    SENT: 'Sent',
    RECEIVED: 'Received',
    PAYBILL: 'Paybill',
    BUY_GOODS: 'Buy Goods',
    WITHDRAW: 'Withdraw',
    DEPOSIT: 'Deposit',
    AIRTIME: 'Airtime',
    FULIZA_BORROW: 'Fuliza',
    FULIZA_REPAY: 'Fuliza Repay',
    REVERSAL: 'Reversal',
    UNKNOWN: 'Transaction',
  };
  return map[type] || 'Transaction';
}

export default function TransactionCard({ transaction, onPress, onCategorize }) {
  const { amount, type, party, date, isExpense, isIncome, category, incomeSource } = transaction;

  // Resolve the display badge: income source takes priority for income txs
  const incomeSrc = isIncome && incomeSource ? INCOME_SOURCES[incomeSource] : null;
  const expenseCat = !isIncome && category ? CATEGORIES[category] : null;
  const badge = incomeSrc || expenseCat;

  const amountColor = isIncome ? COLORS.income : COLORS.expense;
  const amountPrefix = isIncome ? '+' : '-';

  // Icon for the circle: badge icon if we have one, else a default emoji
  const defaultEmoji = isIncome ? '💚' : '💬';
  const circleColor = badge ? `${badge.color}20` : `${COLORS.textMuted}20`;

  // What "uncategorised" prompt to show
  const needsLabel = isIncome ? 'Tap to add income source' : 'Tap to categorise';
  const needsColor = isIncome ? COLORS.income : COLORS.primary;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(transaction)}
      activeOpacity={0.7}
    >
      {/* Left: icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: circleColor }]}>
        <Text style={styles.iconText}>{badge ? badge.icon : defaultEmoji}</Text>
      </View>

      {/* Middle: details */}
      <View style={styles.details}>
        <Text style={styles.typeText} numberOfLines={1}>
          {typeLabel(type)}
          {party ? ` · ${party}` : ''}
        </Text>

        {badge ? (
          <Text style={[styles.categoryText, { color: badge.color }]}>{badge.label}</Text>
        ) : (
          <TouchableOpacity onPress={() => onCategorize && onCategorize(transaction)}>
            <Text style={[styles.categorizePrompt, { color: needsColor }]}>{needsLabel}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.dateText}>
          {date ? format(new Date(date), 'dd MMM yyyy, h:mm a') : ''}
        </Text>
      </View>

      {/* Right: amount */}
      <Text style={[styles.amount, { color: amountColor }]}>
        {amountPrefix}{formatKes(amount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  iconText: {
    fontSize: 20,
  },
  details: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  typeText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  categorizePrompt: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  dateText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  amount: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});

