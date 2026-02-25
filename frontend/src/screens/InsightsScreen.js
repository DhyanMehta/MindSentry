import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { SectionHeader } from '../components/SectionHeader';
import { mockInsights } from '../data/mockData';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';

// --- INLINE DETAIL MODAL COMPONENT ---
const InsightDetailModal = ({ insight, onClose }) => {
  if (!insight) return null;

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View entering={SlideInUp.springify()} style={styles.modalContent}>
        <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
        </View>

        <View style={styles.modalBody}>
            <View style={[styles.modalIconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="bulb" size={32} color={colors.primary} />
            </View>
            
            <Text style={styles.modalTitle}>{insight.title}</Text>
            
            <View style={[styles.statusBadge, { alignSelf: 'center', marginBottom: 24 }]}>
                <Text style={styles.statusText}>{insight.type.toUpperCase()}</Text>
            </View>

            <Text style={styles.modalDetail}>{insight.detail}</Text>
            
            <View style={styles.recommendationBox}>
                <Text style={styles.recommendationTitle}>Recommended Action</Text>
                <Text style={styles.recommendationText}>
                    Try a 5-minute breathing exercise or schedule a short walk to reset your cortisol levels.
                </Text>
            </View>
        </View>
        
        <Pressable onPress={onClose} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Got it</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

// --- MAIN SCREEN ---
export const InsightsScreen = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedInsight, setSelectedInsight] = useState(null);

  const filterCategories = ['All', 'Stress', 'Sleep', 'Mood', 'Focus'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'positive': return colors.success;
      case 'alert': return colors.danger;
      case 'resolved': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
        case 'positive': return colors.success + '15';
        case 'alert': return colors.danger + '15';
        case 'resolved': return colors.primary + '15';
        default: return '#F1F5F9';
      }
  };

  const filteredInsights = mockInsights.filter((insight) => {
    if (activeFilter === 'All') return true;
    return insight.type.toLowerCase() === activeFilter.toLowerCase();
  });

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={SlideInDown.duration(600).delay(100)} style={styles.headerContainer}>
           <SectionHeader title="Wellness Insights" />
        </Animated.View>

        {/* 1. Summary Banner */}
        <Animated.View entering={SlideInDown.duration(600).delay(200)}>
            <LinearGradient
                colors={[colors.primary, '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
            >
                <View>
                    <Text style={styles.summaryTitle}>AI Monitoring Active</Text>
                    <Text style={styles.summarySubtitle}>
                        Analyzing patterns in your voice, mood, and sleep data.
                    </Text>
                </View>
                <Ionicons name="pulse" size={48} color="rgba(255,255,255,0.2)" />
            </LinearGradient>
        </Animated.View>

        {/* 2. Filter Pills */}
        <Animated.View entering={SlideInDown.duration(600).delay(300)}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.filterScrollContent}
            >
            {filterCategories.map((filterItem) => (
                <Pressable
                key={filterItem}
                onPress={() => setActiveFilter(filterItem)}
                style={[
                    styles.filterChip,
                    activeFilter === filterItem && styles.filterChipActive,
                ]}
                >
                <Text
                    style={[
                    styles.filterChipText,
                    activeFilter === filterItem && styles.filterChipTextActive,
                    ]}
                >
                    {filterItem}
                </Text>
                </Pressable>
            ))}
            </ScrollView>
        </Animated.View>

        {/* 3. Insight List */}
        <View style={styles.listContainer}>
            {filteredInsights.map((item, idx) => (
            <Animated.View 
                key={idx} 
                entering={SlideInDown.duration(600).delay(400 + (idx * 100))}
            >
                <Pressable onPress={() => setSelectedInsight(item)} style={styles.insightCard}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconCircle, { backgroundColor: getStatusBg(item.status) }]}>
                            <Ionicons 
                                name={item.status === 'alert' ? 'warning' : 'information'} 
                                size={18} 
                                color={getStatusColor(item.status)} 
                            />
                        </View>
                        <View style={styles.headerTextCol}>
                             <Text style={styles.insightTitle}>{item.title}</Text>
                             <Text style={styles.insightDate}>Today, 2:30 PM</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </View>
                    
                    <Text style={styles.insightDetail} numberOfLines={2}>
                        {item.detail}
                    </Text>

                    <View style={styles.tagsRow}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                             <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                {item.status.toUpperCase()}
                             </Text>
                        </View>
                        <View style={styles.typeBadge}>
                             <Text style={styles.typeText}>{item.type}</Text>
                        </View>
                    </View>
                </Pressable>
            </Animated.View>
            ))}
            
            {filteredInsights.length === 0 && (
                <View style={styles.emptyState}>
                    <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>No insights found for this category.</Text>
                </View>
            )}
        </View>
        
        <View style={{height: 100}} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={!!selectedInsight}
        onRequestClose={() => setSelectedInsight(null)}
      >
        <InsightDetailModal 
            insight={selectedInsight} 
            onClose={() => setSelectedInsight(null)} 
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: responsiveSize.lg,
  },
  headerContainer: {
    marginBottom: responsiveSize.md,
  },
  
  // --- Summary Card ---
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  summaryTitle: {
    fontSize: fontSize.h5,
    color: '#FFFFFF',
    fontWeight: '800',
    marginBottom: 6,
  },
  summarySubtitle: {
    fontSize: fontSize.small,
    color: 'rgba(255, 255, 255, 0.9)',
    maxWidth: 220,
    lineHeight: 20,
  },

  // --- Filter Chips ---
  filterScrollContent: {
    paddingBottom: 20, // Space for shadow
    paddingHorizontal: 4,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // --- Insight Cards ---
  listContainer: {
    gap: 16,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  insightDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  insightDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },

  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    minHeight: '50%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHandle: {
    width: 48,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  modalBody: {
    alignItems: 'center',
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDetail: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  recommendationBox: {
    backgroundColor: '#F8FAFC',
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    marginBottom: 32,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendationText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});