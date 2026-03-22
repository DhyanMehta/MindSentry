import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { ApiService } from '../services/api';
import { AssessmentService } from '../services/assessmentService';
import { responsiveSize, fontSize } from '../utils/responsive';

// ── Inline Detail Modal ────────────────────────────────────────────────────────
const InsightDetailModal = ({ insight, onClose }) => {
  if (!insight) return null;
  const getStatusColor = (status) => {
    if (status === 'positive') return colors.success;
    if (status === 'alert') return colors.danger;
    return colors.primary;
  };

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View>
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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(insight.status) + '20', alignSelf: 'center', marginBottom: 24 }]}>
            <Text style={[styles.statusText, { color: getStatusColor(insight.status) }]}>
              {insight.type?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.modalDetail}>{insight.detail}</Text>
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationTitle}>Recommended Action</Text>
            <Text style={styles.recommendationText}>
              {insight.recommendation_type === 'breathing'
                ? 'Try a 5-minute deep breathing exercise to lower cortisol levels.'
                : insight.recommendation_type === 'journaling'
                  ? 'Write down 3 things you feel grateful for today.'
                  : insight.recommendation_type === 'rest'
                    ? 'Take a 20-minute rest break and avoid screens.'
                    : insight.recommendation_type === 'social'
                      ? 'Connect with a friend or family member for a short chat.'
                      : 'Consider speaking with a mental health professional for further support.'}
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

// ── Main Screen ────────────────────────────────────────────────────────────────
export const InsightsScreen = () => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [insights, setInsights] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [screenError, setScreenError] = useState('');

  const filterCategories = ['All', 'Stress', 'Sleep', 'Mood', 'Focus'];

  const computeSessionWellness = (analysis, risk) => {
    const stress = analysis?.stress_score ?? risk?.stress_score ?? 0.5;
    const mood = analysis?.mood_score != null ? analysis.mood_score : risk?.low_mood_score != null ? 1 - risk.low_mood_score : 0.5;
    return Math.round(((1 - stress) * 0.45 + mood * 0.55) * 100);
  };

  const loadInsights = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setScreenError('');

    try {
      // Get recent assessments
      const assessments = await ApiService.getHistoryAssessments(10);
      setTotalSessions(assessments?.length ?? 0);

      // Find the most recent completed assessment
      const completed = (assessments || []).filter((a) => a.status === 'completed');

      if (completed.length === 0) {
        setInsights([]);
        return;
      }

      // Fetch recommendations from multiple recent assessments (up to 3)
      const recentIds = completed.slice(0, 3).map((a) => a.id);
      const recPromises = recentIds.map((id) =>
        ApiService.getRecommendations(id).catch(() => [])
      );
      const allRecArrays = await Promise.all(recPromises);
      const allRecs = allRecArrays.flat();

      // Deduplicate by title
      const seen = new Set();
      const unique = allRecs.filter((r) => {
        if (seen.has(r.title)) return false;
        seen.add(r.title);
        return true;
      });

      setInsights(unique.map(AssessmentService.recToInsight));

      // Build analysis history rows with score + key insight
      const rows = await Promise.all(
        completed.slice(0, 8).map(async (assessment) => {
          const [analysis, risk, recs] = await Promise.all([
            ApiService.getAnalysisResult(assessment.id).catch(() => null),
            ApiService.getRiskScore(assessment.id).catch(() => null),
            ApiService.getRecommendations(assessment.id).catch(() => []),
          ]);

          const wellnessScore = computeSessionWellness(analysis, risk);
          const topInsight = Array.isArray(recs) && recs.length > 0 ? recs[0].title : 'No insight generated for this session yet.';

          return {
            id: assessment.id,
            date: assessment.started_at,
            score: wellnessScore,
            riskLevel: risk?.final_risk_level || analysis?.support_level || 'low',
            textEmotion: analysis?.text_emotion || 'N/A',
            voiceEmotion: analysis?.audio_emotion || 'N/A',
            faceEmotion: analysis?.video_emotion || 'N/A',
            visualInputType: analysis?.visual_input_type || 'unknown',
            overallSpoofRisk: analysis?.overall_spoof_risk,
            overallIntegrity: analysis?.overall_integrity_score,
            insight: topInsight,
          };
        })
      );
      setHistoryRows(rows);
    } catch (err) {
      console.log('[Insights] Load error:', err.message);
      setInsights([]);
      setHistoryRows([]);
      setScreenError(err.message || 'Could not load insights. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  const getStatusColor = (status) => {
    if (status === 'positive') return colors.success;
    if (status === 'alert') return colors.danger;
    return colors.primary;
  };

  const getStatusBg = (status) => getStatusColor(status) + '15';

  const filteredInsights = insights.filter((insight) => {
    if (activeFilter === 'All') return true;
    return insight.type?.toLowerCase() === activeFilter.toLowerCase();
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your insights...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadInsights(true)}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View>
          <SectionHeader
            title="Wellness Insights"
            showBack
            onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
          />
        </Animated.View>

        <View style={styles.errorBoxWrap}>
          <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
        </View>

        {/* Summary Banner */}
        <Animated.View>
          <LinearGradient
            colors={[colors.primary, '#8B5CF6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View>
              <Text style={styles.summaryTitle}>
                {totalSessions > 0 ? 'AI Monitoring Active' : 'Start Your Journey'}
              </Text>
              <Text style={styles.summarySubtitle}>
                {totalSessions > 0
                  ? `${totalSessions} sessions analyzed. Pull down to refresh.`
                  : 'Complete a check-in to see personalized insights.'}
              </Text>
            </View>
            <Ionicons name="pulse" size={48} color="rgba(255,255,255,0.2)" />
          </LinearGradient>
        </Animated.View>

        {/* Filter Pills */}
        <Animated.View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {filterCategories.map((filterItem) => (
              <Pressable
                key={filterItem}
                onPress={() => setActiveFilter(filterItem)}
                style={[styles.filterChip, activeFilter === filterItem && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, activeFilter === filterItem && styles.filterChipTextActive]}>
                  {filterItem}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Recent Analysis History</Text>
          {historyRows.length === 0 ? (
            <View style={styles.historyEmpty}>
              <Text style={styles.emptyText}>No completed analysis sessions to show yet.</Text>
            </View>
          ) : (
            historyRows.map((row) => (
              <View key={row.id} style={styles.historyCard}>
                <View style={styles.historyTopRow}>
                  <Text style={styles.historyDate}>{row.date ? new Date(row.date).toLocaleDateString() : 'Recent'}</Text>
                  <View style={[styles.historyRiskPill, row.riskLevel === 'high' ? styles.riskHigh : row.riskLevel === 'medium' ? styles.riskMedium : styles.riskLow]}>
                    <Text style={styles.historyRiskText}>{row.riskLevel.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.historyScoreRow}>
                  <Text style={styles.historyScoreValue}>{row.score}</Text>
                  <Text style={styles.historyScoreLabel}>Wellness Score</Text>
                </View>
                <Text style={styles.historyInsightText}>{row.insight}</Text>
                <Text style={styles.historyMetaText}>Text: {row.textEmotion} | Voice: {row.voiceEmotion} | Face: {row.faceEmotion}</Text>
                <Text style={styles.historyMetaText}>
                  Input: {row.visualInputType} | Integrity: {row.overallIntegrity != null ? `${Math.round(row.overallIntegrity * 100)}%` : 'N/A'} | Spoof risk: {row.overallSpoofRisk != null ? `${Math.round(row.overallSpoofRisk * 100)}%` : 'N/A'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Insight List */}
        <View style={styles.listContainer}>
          {filteredInsights.length === 0 ? (
            <Animated.View>
              <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {totalSessions === 0
                  ? 'No check-ins yet. Start your first session!'
                  : activeFilter === 'All'
                    ? 'No insights available yet. Check back after more sessions.'
                    : `No ${activeFilter} insights found.`}
              </Text>
            </Animated.View>
          ) : (
            filteredInsights.map((item, idx) => (
              <Animated.View
                key={item.id || idx}
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
                      <Text style={styles.insightDate}>
                        {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.insightDetail} numberOfLines={2}>{item.detail}</Text>
                  <View style={styles.tagsRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{item.type}</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        animationType="none"
        transparent
        visible={!!selectedInsight}
        onRequestClose={() => setSelectedInsight(null)}
      >
        <InsightDetailModal insight={selectedInsight} onClose={() => setSelectedInsight(null)} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: responsiveSize.lg },
  errorBoxWrap: { marginBottom: 8 },
  headerContainer: { marginBottom: responsiveSize.md },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 16, fontSize: 15, color: colors.textSecondary },

  summaryCard: {
    borderRadius: 20, padding: 24, marginBottom: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  summaryTitle: { fontSize: fontSize.h5, color: '#FFFFFF', fontWeight: '800', marginBottom: 6 },
  summarySubtitle: { fontSize: fontSize.small, color: 'rgba(255,255,255,0.9)', maxWidth: 220, lineHeight: 20 },

  filterScrollContent: { paddingBottom: 20, paddingHorizontal: 4 },
  filterChip: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF', marginRight: 10,
  },
  filterChipActive: {
    borderColor: colors.primary, backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  filterChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  historySection: { marginBottom: 18 },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  historyEmpty: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyDate: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  historyRiskPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  historyRiskText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  riskHigh: { backgroundColor: '#DC2626' },
  riskMedium: { backgroundColor: '#D97706' },
  riskLow: { backgroundColor: '#059669' },
  historyScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  historyScoreValue: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, marginRight: 8 },
  historyScoreLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  historyInsightText: { marginTop: 8, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  historyMetaText: { marginTop: 6, fontSize: 12, color: colors.textSecondary },

  listContainer: { gap: 16 },
  insightCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTextCol: { flex: 1 },
  insightTitle: { fontSize: 16, color: colors.textPrimary, fontWeight: '700' },
  insightDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  insightDetail: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  tagsRow: { flexDirection: 'row', gap: 8 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  typeBadge: { backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  typeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: colors.textSecondary, marginTop: 10, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, minHeight: '50%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
  },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalHandle: { width: 48, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 16 },
  closeButton: { position: 'absolute', right: 0, top: 0, padding: 4 },
  modalBody: { alignItems: 'center' },
  modalIconBox: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  modalDetail: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  recommendationBox: {
    backgroundColor: '#F8FAFC', width: '100%', padding: 20,
    borderRadius: 16, borderLeftWidth: 4, borderLeftColor: colors.secondary, marginBottom: 32,
  },
  recommendationTitle: {
    fontSize: 14, fontWeight: '700', color: colors.textPrimary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  recommendationText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  primaryButton: {
    backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
