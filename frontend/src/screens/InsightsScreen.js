import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { InsightDetailCard } from '../components/InsightDetailCard'; // Import the new component
import { mockInsights } from '../data/mockData';

export const InsightsScreen = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);

  const filterCategories = ['All', 'Stress', 'Sleep', 'Mood', 'Behavior'];

  const getStatusStyle = (status) => {
    switch (status) {
      case 'positive':
        return { backgroundColor: 'rgba(0, 196, 140, 0.15)', color: colors.success, borderColor: colors.success }; // Green for positive
      case 'alert':
        return { backgroundColor: 'rgba(255, 107, 107, 0.18)', color: colors.danger, borderColor: colors.danger }; // Red for alert
      case 'resolved':
        return { backgroundColor: 'rgba(108, 92, 231, 0.15)', color: colors.primary, borderColor: colors.primary }; // A neutral/primary color for resolved
      default:
        return { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: colors.textSecondary, borderColor: colors.divider }; // Default for unknown status
    }
  };

  const filteredInsights = mockInsights.filter((insight) => {
    if (activeFilter === 'All') {
      return true;
    }
    return insight.type.toLowerCase() === activeFilter.toLowerCase();
  });

  const handleCardPress = (insight) => {
    setSelectedInsight(insight);
    setIsDetailModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalVisible(false);
    setSelectedInsight(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <SectionHeader title="Insights" />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Early alerting is on</Text>
        <Text style={styles.summarySubtitle}>We will flag anomalies in stress, sleep, and mood</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {filterCategories.map((filterItem, index) => (
            <Pressable
              key={filterItem}
              onPress={() => setActiveFilter(filterItem)}
              style={[
                styles.filterChip,
                activeFilter === filterItem ? styles.filterChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filterItem ? styles.filterChipTextActive : null,
                ]}
              >
                {filterItem}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        </View>

      {filteredInsights.map((item, idx) => (
        <Pressable key={item.title} onPress={() => handleCardPress(item)} style={styles.insightCard}>
          <Text style={styles.insightTitle}>{item.title}</Text>
          <Text style={styles.insightDetail}>{item.detail}</Text>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={[styles.statusText, { color: getStatusStyle(item.status).color }]}>{item.status}</Text>
          </View>
        </Pressable>
      ))}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isDetailModalVisible}
        onRequestClose={handleCloseModal}
      >
        <InsightDetailCard insight={selectedInsight} onClose={handleCloseModal} />
      </Modal>
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
    padding: 18,
    marginBottom: 16,
  },
  summaryTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  summarySubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 6,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScrollContent: {
    paddingVertical: 4,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
  },
  filterChipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 18,
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
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    marginTop: 8,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
  },
});
