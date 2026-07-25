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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { getSettings, saveSettings, clearAllTransactions } from '../utils/storage';
import { resetPatterns } from '../utils/categoryLearning';

/**
 * SettingsScreen
 * 
 * Provides configuration options for the M-Pesa Tracker React Native app:
 * - ACCOUNT Section: M-Pesa Number, Display Name
 * - DATA Section: Export Transactions (Stub), Clear All Data
 * - ABOUT Section: Version, Built for Kenya 🇰🇪 info
 */
export default function SettingsScreen() {
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Load user settings on focus/mount
  const loadSettings = useCallback(async () => {
    try {
      const settings = await getSettings();
      setMpesaNumber(settings.mpesaNumber || '');
      setDisplayName(settings.displayName || '');
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  // Auto-save setting changes to SQLite
  const handleMpesaNumberChange = async (text) => {
    setMpesaNumber(text);
    await saveSettings({ mpesaNumber: text });
  };

  const handleDisplayNameChange = async (text) => {
    setDisplayName(text);
    await saveSettings({ displayName: text });
  };

  // Stub function for exporting transactions
  const exportTransactions = () => {
    Alert.alert(
      'Export Transactions',
      'Your transactions are being compiled... This feature is currently in preview and will allow CSV exports in the next update! 🚀',
      [{ text: 'OK', onPress: () => {} }],
      { cancelable: true }
    );
  };

  // Safe data reset routine
  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you absolutely sure you want to delete all transactions and reset your learned categories? This action is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await clearAllTransactions();
              await resetPatterns();
              if (success) {
                Alert.alert(
                  'Data Cleared',
                  'All stored transactions and learned patterns have been successfully cleared.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Error', 'Could not clear database. Please try again.');
              }
            } catch (err) {
              console.error('Error clearing data:', err);
              Alert.alert('Error', 'An unexpected error occurred while resetting.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Configure account profile and local storage</Text>
        </View>

        {/* ACCOUNT Section */}
        <SettingsSection title="ACCOUNT">
          <SettingsRow
            label="M-Pesa Number"
            rightElement={
              <TextInput
                style={styles.input}
                value={mpesaNumber}
                onChangeText={handleMpesaNumberChange}
                keyboardType="numeric"
                placeholder="e.g. 0712 345 678"
                placeholderTextColor={COLORS.textMuted}
              />
            }
          />
          <SettingsRow
            label="Display Name"
            rightElement={
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={handleDisplayNameChange}
                placeholder="e.g. Jane Doe"
                placeholderTextColor={COLORS.textMuted}
              />
            }
          />
        </SettingsSection>

        {/* DATA Section */}
        <SettingsSection title="DATA">
          <SettingsRow
            label="Export Transactions"
            onPress={exportTransactions}
            rightElement={<Text style={styles.chevron}>›</Text>}
          />
          <SettingsRow
            label="Clear All Data"
            labelColor={COLORS.error}
            onPress={handleClearAllData}
          />
        </SettingsSection>

        {/* ABOUT Section */}
        <SettingsSection title="ABOUT">
          <SettingsRow
            label="Version"
            rightElement={<Text style={styles.staticValue}>1.0.0</Text>}
          />
          <SettingsRow
            label="Built for Kenya 🇰🇪"
            rightElement={<Text style={styles.staticValue}>Active</Text>}
          />
        </SettingsSection>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * SettingsSection Wrapper
 */
function SettingsSection({ title, children }) {
  // Filter out any falsy children (null/undefined)
  const validChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.sectionContainer}>
      {title && <Text style={styles.sectionHeader}>{title}</Text>}
      <View style={styles.sectionCard}>
        {validChildren.map((child, index) => {
          const isLast = index === validChildren.length - 1;
          return (
            <React.Fragment key={index}>
              {child}
              {!isLast && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/**
 * SettingsRow Row Component
 */
function SettingsRow({ label, rightElement, onPress, labelColor = COLORS.text }) {
  const content = (
    <View style={styles.rowInner}>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      {rightElement}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.rowContainer}
        onPress={onPress}
        activeOpacity={0.6}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.rowContainer}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.lg,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
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
  // Section layout
  sectionContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  // Row layout
  rowContainer: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  rowLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: SPACING.md,
  },
  // Inputs & Values
  input: {
    flex: 1,
    textAlign: 'right',
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.md,
    paddingVertical: 8,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textMuted,
    fontWeight: '300',
    marginTop: -2,
  },
  staticValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  footerSpacing: {
    height: SPACING.xl,
  },
});
