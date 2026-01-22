import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

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
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.divider,
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
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  trendBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  trendUp: {
    backgroundColor: 'rgba(0, 196, 140, 0.15)',
  },
  trendDown: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
  },
  trendText: {
    ...typography.small,
    color: colors.textPrimary,
  },
});
