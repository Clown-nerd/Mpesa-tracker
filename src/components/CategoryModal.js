import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORY_LIST } from '../constants/categories';
import { getTopCategories } from '../utils/categoryLearning';

export default function CategoryModal({ visible, transaction, onSelect, onClose }) {
  const [note, setNote] = useState('');
  const [topCategoryIds, setTopCategoryIds] = useState([]);

  // Load the user's top 3 most-used categories when the modal opens
  useEffect(() => {
    if (visible) {
      getTopCategories('expense', 3)
        .then(setTopCategoryIds)
        .catch(() => setTopCategoryIds([]));
    }
  }, [visible]);

  // Reorder the category list: top categories first, then the rest
  const orderedCategories = useMemo(() => {
    if (!topCategoryIds.length) return CATEGORY_LIST;
    const topSet = new Set(topCategoryIds);
    const top = topCategoryIds
      .map((id) => CATEGORY_LIST.find((c) => c.id === id))
      .filter(Boolean);
    const rest = CATEGORY_LIST.filter((c) => !topSet.has(c.id));
    return [...top, ...rest];
  }, [topCategoryIds]);

  if (!transaction) return null;

  const handleSelect = (category) => {
    onSelect(transaction, category.id, note);
    setNote('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>What was this for?</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {transaction.type === 'FULIZA_BORROW' ? '🔔 Fuliza borrowing detected' : ''}
            KES {Number(transaction.amount).toLocaleString()}{' '}
            {transaction.party ? `· ${transaction.party}` : ''}
          </Text>

          <FlatList
            data={orderedCategories}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => handleSelect(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${item.color}20` }]}>
                  <Text style={styles.emoji}>{item.icon}</Text>
                </View>
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />

          <TextInput
            style={styles.noteInput}
            placeholder="Add a note (optional)"
            placeholderTextColor={COLORS.textMuted}
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Skip</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  grid: {
    paddingBottom: SPACING.md,
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emoji: {
    fontSize: 24,
  },
  categoryLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});
