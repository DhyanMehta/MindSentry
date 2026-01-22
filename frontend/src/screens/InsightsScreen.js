import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { mockInsights } from '../data/mockData';

export const InsightsScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader title="Insights" />

      <View style={styles.summaryCard}>
        <Text style={styles.title}>Early alerting is on</Text>
        <Text style={styles.subtitle}>We will flag anomalies in stress, sleep, and mood</Text>
      </View>

      {mockInsights.map((item, idx) => (
        <View key={idx} style={styles.insight}>
          <Text style={styles.insightTitle}>{item.title}</Text>
          <Text style={styles.insightDetail}>{item.detail}</Text>
          <Text style={styles.status}>{item.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 14,
    marginBottom: 16,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  insight: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 14,
    marginBottom: 12,
  },
  insightTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  insightDetail: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 4,
  },
  status: {
    ...typography.small,
    color: colors.secondary,
    fontWeight: '600',
  },
});
