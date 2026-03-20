import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize } from '../utils/responsive';

export const SectionHeader = ({ title, action, onActionPress, showBack = false, onBackPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack ? (
          <Pressable onPress={onBackPress} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
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
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    marginRight: 8,
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
