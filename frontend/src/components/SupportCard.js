import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize, cardDimensions, borderRadius, shadows } from '../utils/responsive';

export const SupportCard = ({ title, description, badge }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.large,
    padding: cardDimensions.padding,
    marginBottom: responsiveSize.md,
    borderWidth: 0,
    ...shadows.small,
    borderLeftWidth: 6,
    borderLeftColor: colors.primaryTint,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  description: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  badge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    color: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    ...typography.small,
    fontWeight: '700',
  },
});
