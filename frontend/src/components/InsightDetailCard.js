import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { responsiveSize, cardDimensions, borderRadius, shadows } from '../utils/responsive';

export const InsightDetailCard = ({ insight, onClose }) => {
  if (!insight) return null;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'positive':
        return { backgroundColor: colors.successTint, color: colors.success, borderColor: colors.success };
      case 'alert':
        return { backgroundColor: colors.dangerTint, color: colors.danger, borderColor: colors.danger };
      case 'resolved':
        return { backgroundColor: colors.primaryTint, color: colors.primary, borderColor: colors.primary };
      default:
        return { backgroundColor: colors.card, color: colors.textSecondary, borderColor: colors.divider };
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{insight.title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.detail}>{insight.detail}</Text>
          <View style={[styles.statusBadge, getStatusStyle(insight.status)]}>
            <Text style={[styles.statusText, { color: getStatusStyle(insight.status).color }]}>{insight.status}</Text>
          </View>

          <Text style={styles.longDescription}>{insight.longDescription}</Text>

          {insight.actionableSteps && insight.actionableSteps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actionable Steps</Text>
              {insight.actionableSteps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} style={styles.stepIcon} />
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.extraLarge,
    padding: cardDimensions.padding,
    width: '92%',
    maxHeight: '82%',
    borderWidth: 0,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flexShrink: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 0,
    marginTop: 5,
    marginBottom: 15,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
  longDescription: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
  },
  section: {
    marginTop: 15,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  stepText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
});
