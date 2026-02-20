import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize, cardDimensions, borderRadius, shadows } from '../utils/responsive';

export const MetricCard = ({ title, value, subtitle, trend }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{value}</Text>
        {trend ? (
          <View style={[styles.trendBadge, trend.type === 'up' ? styles.trendUp : styles.trendDown]}>
            <Text style={styles.trendText}>{trend.value}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.large,
    padding: cardDimensions.padding,
    marginBottom: responsiveSize.md,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    ...shadows.small,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  title: {
    ...typography.small,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  value: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  trendBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendUp: {
    backgroundColor: colors.successTint,
  },
  trendDown: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  trendText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
