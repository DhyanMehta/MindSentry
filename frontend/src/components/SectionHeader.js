import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize } from '../utils/responsive';

export const SectionHeader = ({ title, action }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSize.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  action: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
});
