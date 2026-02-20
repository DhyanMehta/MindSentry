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
        return { backgroundColor: colors.successTint, color: colors.success, borderColor: colors.success };
      case 'alert':
        return { backgroundColor: colors.dangerTint, color: colors.danger, borderColor: colors.danger };
      case 'resolved':
        return { backgroundColor: colors.primaryTint, color: colors.primary, borderColor: colors.primary };
      default:
        return { backgroundColor: colors.card, color: colors.textSecondary, borderColor: colors.divider };
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
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderWidth: 0,
    padding: 24,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryTitle: {
    ...typography.h2,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  summarySubtitle: {
    ...typography.small,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 10,
    fontSize: 14,
  },
  filterContainer: {
    marginBottom: 22,
  },
  filterScrollContent: {
    paddingVertical: 8,
  },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primaryTint,
    backgroundColor: colors.card,
    marginRight: 10,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  filterChipText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  insightCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.secondaryTint,
    padding: 18,
    marginBottom: 14,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  insightTitle: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  insightDetail: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 2,
    marginTop: 12,
  },
  statusText: {
    ...typography.small,
    fontWeight: '700',
    fontSize: 12,
  },
});
