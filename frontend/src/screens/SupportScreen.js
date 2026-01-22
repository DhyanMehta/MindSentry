import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { SupportCard } from '../components/SupportCard';
import { mockResources } from '../data/mockData';

export const SupportScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader title="Support" />

      <View style={styles.helperCard}>
        <Text style={styles.helperTitle}>AI Counselor</Text>
        <Text style={styles.helperText}>
          Draft empathetic responses and self-help plans. Integrate with LangChain later for retrieval + action routing.
        </Text>
      </View>

      {mockResources.map((item, idx) => (
        <SupportCard key={idx} title={item.title} description={item.description} badge="Available offline" />
      ))}

      <View style={styles.notice}>
        <Text style={styles.noticeText}>Not a replacement for professional care.</Text>
      </View>
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
  helperCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 14,
    marginBottom: 14,
  },
  helperTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  helperText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  noticeText: {
    ...typography.small,
    color: colors.textSecondary,
  },
});
