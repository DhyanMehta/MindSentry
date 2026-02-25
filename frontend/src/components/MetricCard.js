import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize, fontSize } from '../utils/responsive';

export const MetricCard = ({ title, value, subtitle, trend }) => {
  const trendIcon = trend ? (trend.type === 'up' ? 'arrow-up' : 'arrow-down') : null;
  const trendColor = trend ? (trend.type === 'up' ? colors.success : colors.danger) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
      <View style={styles.footer}>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons name={trendIcon} size={responsiveSize.sm} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>{trend.value}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: responsiveSize.base,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: 'space-between',
  },
  title: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: responsiveSize.sm,
  },
  value: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: responsiveSize.sm,
  },
  footer: {
    
  },
  subtitle: {
    ...typography.tiny,
    color: colors.textMuted,
    fontSize: fontSize.tiny * 0.9,
    lineHeight: fontSize.tiny * 1.4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSize.xs,
  },
  trendText: {
    ...typography.small,
    fontWeight: '700',
    marginLeft: responsiveSize.xs / 2,
  },
});
