import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface PremiumStatsCardProps {
  isPremium: boolean;
  title: string;
  children: React.ReactNode;
}

export function PremiumStatsCard({ isPremium, title, children }: PremiumStatsCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={18} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {isPremium ? (
        children
      ) : (
        <View style={styles.lockedContainer}>
          <View style={styles.blurredContent}>
            <View style={styles.blurredLine} />
            <View style={[styles.blurredLine, { width: '60%' }]} />
            <View style={[styles.blurredLine, { width: '80%' }]} />
          </View>
          <View style={styles.ctaRow}>
            <Ionicons name="lock-closed-outline" size={14} color={Colors.primary} />
            <Text style={styles.ctaText}>Unlock with Premium</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: Colors.textPrimary,
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
    backgroundColor: '#CCC',
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
    color: Colors.primary,
  },
});
