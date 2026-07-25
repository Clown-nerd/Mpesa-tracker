import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
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

export default function TransactionDetailModal({
  visible,
  transaction,
  onClose,
  onCategorize,
  onDelete,
}) {
  if (!transaction) return null;

  const {
    id,
    confirmationCode,
    type,
    amount,
    party,
    date,
    isExpense,
    isIncome,
    category,
    incomeSource,
    balance,
    accountNumber,
    note,
  } = transaction;

  // Resolve the display badge: income source takes priority for income txs
  const incomeSrc = isIncome && incomeSource ? INCOME_SOURCES[incomeSource] : null;
  const expenseCat = !isIncome && category ? CATEGORIES[category] : null;
  const badge = incomeSrc || expenseCat;

  const amountColor = isIncome ? COLORS.income : COLORS.expense;
  const amountPrefix = isIncome ? '+' : '-';

  // Circle emoji and color
  const defaultEmoji = isIncome ? '💚' : '💬';
  const circleColor = badge ? `${badge.color}15` : `${COLORS.textMuted}15`;
  const iconEmoji = badge ? badge.icon : defaultEmoji;

  // Format Date: "Thursday, 22 May 2026 at 9:05 AM"
  let formattedDate = '';
  if (date) {
    try {
      formattedDate = format(new Date(date), "EEEE, d MMMM yyyy 'at' h:mm a");
    } catch (e) {
      formattedDate = String(date);
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (onDelete) {
              await onDelete(id);
            }
            onClose();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleEditCategory = () => {
    onClose();
    if (onCategorize) {
      onCategorize(transaction);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Navigation Bar Header */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Transaction Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Visual Header */}
          <View style={styles.visualHeader}>
            <View style={[styles.largeIconCircle, { backgroundColor: circleColor }]}>
              <Text style={styles.largeIconText}>{iconEmoji}</Text>
            </View>

            <Text style={[styles.largeAmount, { color: amountColor }]}>
              {amountPrefix}{formatKes(amount)}
            </Text>

            <Text style={styles.typeText}>{typeLabel(type)}</Text>
          </View>

          {/* Details List */}
          <View style={styles.detailsList}>
            {/* Confirmation Code */}
            {confirmationCode ? (
              <DetailRow label="Confirmation Code" value={confirmationCode} />
            ) : null}

            {/* Party */}
            {party ? (
              <DetailRow label={isIncome ? 'Sender' : 'Recipient'} value={party} />
            ) : null}

            {/* Date & Time */}
            {formattedDate ? (
              <DetailRow label="Date & Time" value={formattedDate} />
            ) : null}

            {/* Balance After */}
            {balance !== null && balance !== undefined ? (
              <DetailRow label="Balance After" value={formatKes(balance)} />
            ) : null}

            {/* Account Number (Paybill Only) */}
            {type === 'PAYBILL' && accountNumber ? (
              <DetailRow label="Account Number" value={accountNumber} />
            ) : null}

            {/* Category / Income Source */}
            <View style={styles.rowContainer}>
              <Text style={styles.rowLabel}>
                {isIncome ? 'Income Source' : 'Category'}
              </Text>
              {badge ? (
                <View style={[styles.badgeContainer, { backgroundColor: `${badge.color}15` }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>
                    {badge.icon}  {badge.label}
                  </Text>
                </View>
              ) : (
                <View style={[styles.badgeContainer, { backgroundColor: `${COLORS.textMuted}15` }]}>
                  <Text style={[styles.badgeText, { color: COLORS.textSecondary }]}>
                    ⚠️  Uncategorised
                  </Text>
                </View>
              )}
            </View>

            {/* Note */}
            {note ? (
              <DetailRow label="Note" value={note} isMultiLine />
            ) : null}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditCategory}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>
              {badge ? 'Edit Category' : isIncome ? 'Add Income Source' : 'Categorise'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>Delete Transaction</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function DetailRow({ label, value, isMultiLine = false }) {
  return (
    <View style={[styles.rowContainer, isMultiLine && styles.multiLineContainer]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, isMultiLine && styles.multiLineValue]}
        numberOfLines={isMultiLine ? 3 : 1}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  navTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  visualHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  largeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  largeIconText: {
    fontSize: 36,
  },
  largeAmount: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '800',
    marginBottom: SPACING.xs,
    letterSpacing: -0.5,
  },
  typeText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailsList: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  rowContainer: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  multiLineContainer: {
    height: 'auto',
    minHeight: 48,
    paddingVertical: SPACING.sm,
    alignItems: 'flex-start',
  },
  rowLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  multiLineValue: {
    flex: 1,
    textAlign: 'right',
    marginLeft: SPACING.md,
  },
  badgeContainer: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  editButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  deleteButton: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
