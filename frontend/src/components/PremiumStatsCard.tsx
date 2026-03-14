import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface PremiumStatsCardProps {
  isPremium: boolean;
  title: string;
  children: React.ReactNode;
}

export function PremiumStatsCard({ isPremium, title, children }: PremiumStatsCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {isPremium ? (
        children
      ) : (
        <View style={styles.lockedContainer}>
          <View style={styles.blurredContent}>
            <View style={[styles.blurredLine, { backgroundColor: colors.surfaceAlt }]} />
            <View style={[styles.blurredLine, { width: '60%', backgroundColor: colors.surfaceAlt }]} />
            <View style={[styles.blurredLine, { width: '80%', backgroundColor: colors.surfaceAlt }]} />
          </View>
          <View style={styles.ctaRow}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
            <Text style={[styles.ctaText, { color: colors.primary }]}>Unlock with Premium</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  lockedContainer: {
    gap: 12,
  },
  blurredContent: {
    gap: 8,
    opacity: 0.3,
  },
  blurredLine: {
    height: 14,
    borderRadius: 4,
    width: '100%',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
