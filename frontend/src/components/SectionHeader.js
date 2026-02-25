import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize } from '../utils/responsive';

export const SectionHeader = ({ title, action, onActionPress }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <Pressable onPress={onActionPress}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSize.base,
    paddingTop: responsiveSize.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  action: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
