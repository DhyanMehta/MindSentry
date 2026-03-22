import React, { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, StatusBar, useWindowDimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';
import { ErrorBox } from '../components/ErrorBox';
import { AuthContext } from '../context/AuthContext';
import { ApiService } from '../services/api';
import { AssessmentService } from '../services/assessmentService';
import { responsiveSize, fontSize } from '../utils/responsive';

const LOW_WELLNESS_THRESHOLD = 45;

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { width: screenWidth } = useWindowDimensions();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [screenError, setScreenError] = useState('');
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [analysisByAssessment, setAnalysisByAssessment] = useState({});

  const hasData = (summary?.total_assessments ?? 0) > 0;
  const wellnessScoreNumber = AssessmentService.computeWellnessScore(summary);
  const wellnessScore = wellnessScoreNumber ?? '--';

  const stressPercent = hasData ? `${Math.round((summary.avg_stress_score ?? 0.5) * 100)}%` : 'N/A';
  const moodPercent = hasData ? `${Math.round((summary.avg_mood_score ?? 0.5) * 100)}%` : 'N/A';
  const moodScoreValue = summary?.avg_mood_score;

  const getAIMoodLabel = useCallback((moodScore) => {
    if (moodScore == null || Number.isNaN(Number(moodScore))) return 'Not enough data';
    const value = Number(moodScore);
    if (value >= 0.75) return 'Positive';
    if (value >= 0.55) return 'Balanced';
    if (value >= 0.4) return 'Low';
    return 'Very Low';
  }, []);

  const aiMoodLabel = getAIMoodLabel(moodScoreValue);

  const computeStreak = useCallback((assessments) => {
    if (!assessments || assessments.length === 0) return 0;
    const days = new Set(assessments.map((a) => new Date(a.started_at).toDateString()));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, []);

  const streak = computeStreak(recentAssessments);
  const lastBurnout = trend.length > 0 ? trend[trend.length - 1]?.burnout_score ?? 0.3 : 0.3;

  const metricsData = [
    { title: 'Stress', value: stressPercent, subtitle: 'AI estimate', icon: 'pulse-outline', bg: '#FEE2E2', iconColor: '#DC2626' },
    { title: 'Mood', value: moodPercent, subtitle: 'AI estimate', icon: 'happy-outline', bg: '#DCFCE7', iconColor: '#16A34A' },
    { title: 'Focus', value: hasData ? `${Math.round((1 - lastBurnout) * 100)}%` : 'N/A', subtitle: 'Trend based', icon: 'sparkles-outline', bg: '#DBEAFE', iconColor: '#2563EB' },
    { title: 'Streak', value: `${streak} days`, subtitle: 'Consistency', icon: 'flame-outline', bg: '#FEF3C7', iconColor: '#D97706' },
  ];

  const recentSorted = [...recentAssessments]
    .filter((item) => !!item?.id)
    .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));

  const showLowScorePrecautions = wellnessScoreNumber != null && wellnessScoreNumber < LOW_WELLNESS_THRESHOLD;

  const formatHistoryMeta = useCallback((assessment, analysis) => {
    const scoreRaw = analysis?.wellness_score;
    const moodRaw = analysis?.mood_score;

    const score = scoreRaw != null ? `${Math.round(Number(scoreRaw))}` : '--';
    const mood = moodRaw != null ? `${Math.round(Number(moodRaw) * 100)}%` : '--';

    return `Check-in - Score ${score} - Mood ${mood}`;
  }, []);

  const preloadAnalysis = useCallback(async (assessments) => {
    const top = assessments.slice(0, 5);
    const entries = await Promise.all(
      top.map(async (item) => {
        try {
          const result = await ApiService.getAnalysisResult(item.id);
          return [item.id, result];
        } catch {
          return [item.id, null];
        }
      })
    );
    setAnalysisByAssessment((prev) => {
      const next = { ...prev };
      entries.forEach(([id, data]) => {
        next[id] = data;
      });
      return next;
    });
  }, []);

  const openAssessmentDetails = useCallback(async (assessment) => {
    navigation.navigate('CheckInScreen', { assessmentId: assessment?.id });
  }, [navigation]);

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setScreenError('');
    try {
      const [summaryData, trendData, assessmentData] = await Promise.all([
        ApiService.getHistorySummary(),
        ApiService.getHistoryTrend(7),
        ApiService.getHistoryAssessments(5),
      ]);
      setSummary(summaryData);
      setTrend(Array.isArray(trendData) ? trendData : []);
      const recent = Array.isArray(assessmentData)
        ? assessmentData
        : Array.isArray(assessmentData?.items)
          ? assessmentData.items
          : [];
      setRecentAssessments(recent);
      preloadAnalysis(recent);
    } catch (error) {
      console.log('[Dashboard] Load error:', error.message);
      setScreenError(error.message || 'Could not load dashboard data. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  }, [preloadAnalysis]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh when screen is focused and keep data fresh while user stays on screen.
  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(() => {
        loadData();
      }, 20000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const userName = user?.name ? user.name.split(' ')[0] : 'Back';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>Welcome {userName}!</Text>
          <Text style={styles.dateText}>
            {hasData ? 'Here is your wellness snapshot.' : 'Start your first check-in below.'}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.logoutButton}>
          <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {screenError ? (
        <View style={{ paddingHorizontal: responsiveSize.lg }}>
          <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
        </View>
      ) : null}

      {/* Hero Card */}
      <Animated.View entering={FadeIn.duration(400).easing(Easing.out(Easing.cubic))}>
        <LinearGradient
          colors={[colors.gradientStart || '#6D28D9', colors.gradientMid || '#A855F7']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroMainContent}>
            {isLoadingData
              ? <ActivityIndicator color="#fff" size="large" />
              : <>
                <Text style={styles.heroScore}>{wellnessScore}</Text>
                <Text style={styles.heroLabel}>Mental Wellness Score</Text>
                <Text style={styles.heroMoodLabel}>AI Mood: {aiMoodLabel}</Text>
              </>
            }
          </View>
          <Text style={styles.heroFooter}>
            {hasData
              ? `Based on ${summary.completed_assessments} completed sessions`
              : 'Complete a check-in to see your score'}
          </Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(400).delay(100).easing(Easing.out(Easing.cubic))}>
        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeaderRow}>
            <View style={styles.disclaimerIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#9A3412" />
            </View>
            <Text style={styles.disclaimerTitle}>AI Disclaimer</Text>
          </View>
          <Text style={styles.disclaimerText}>
            This app provides AI-based wellness signals and is not a final medical diagnosis. Consult a qualified doctor for clinical decisions.
          </Text>
        </View>
      </Animated.View>

      {showLowScorePrecautions && (
        <Animated.View entering={FadeIn.duration(400).delay(200).easing(Easing.out(Easing.cubic))}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={18} color={colors.danger} />
              <Text style={styles.warningTitle}>Immediate Precautions</Text>
            </View>
            <Text style={styles.warningText}>1) Pause high-stress tasks and prioritize rest today.</Text>
            <Text style={styles.warningText}>2) Talk to a trusted friend/family member if distress rises.</Text>
            <Text style={styles.warningText}>3) If you feel unsafe, contact emergency/crisis services immediately.</Text>
            <Text style={styles.warningText}>Medication guidance: do not start, stop, or change medicines without a licensed doctor.</Text>
          </View>
        </Animated.View>
      )}

      {/* Actions */}
      <Animated.View entering={FadeIn.duration(400).delay(400).easing(Easing.out(Easing.cubic))}>
        <View style={styles.actionsRow}>
          <Pressable style={[styles.quickActionButton, styles.primaryAction]} onPress={() => navigation.navigate('CheckInScreen')}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={styles.actionIcon} />
            <Text style={styles.actionTitlePrimary}>Daily Check-in</Text>
          </Pressable>
          <Pressable style={[styles.quickActionButton, styles.secondaryAction]} onPress={() => navigation.navigate('ChatBot')}>
            <Ionicons name="chatbubbles-outline" size={20} color={colors.textPrimary} style={styles.actionIcon} />
            <Text style={styles.actionTitleSecondary}>AarogyaAI</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Metrics */}
      <Animated.View entering={FadeIn.duration(400).delay(500).easing(Easing.out(Easing.cubic))}>
        <Text style={styles.sectionTitle}>Today's Metrics</Text>
        <View style={styles.metricsGrid}>
          {metricsData.map((metric) => (
            <View key={metric.title} style={[styles.metricCard, { width: screenWidth > 420 ? '48.2%' : '100%' }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: metric.bg }]}>
                <Ionicons name={metric.icon} size={18} color={metric.iconColor} />
              </View>
              <Text style={styles.metricTitle}>{metric.title}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricSub}>{metric.subtitle}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Recent Sessions */}
      <Animated.View style={styles.sectionContainer} entering={FadeIn.duration(400).delay(1000).easing(Easing.out(Easing.cubic))}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
        </View>
        <View style={styles.insightListContainer}>
          {isLoadingData ? (
            <View style={styles.emptyInsights}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.emptyInsightsText}>Loading recent activity...</Text>
            </View>
          ) : recentSorted.length === 0 ? (
            <View style={styles.emptyInsights}>
              <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyInsightsText}>No sessions yet. Complete your first check-in!</Text>
            </View>
          ) : (
            recentSorted.map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => openAssessmentDetails(item)}
                style={[styles.insightRow, idx !== recentSorted.length - 1 && styles.insightBorder]}
              >
                <View style={styles.insightIconCircle}>
                  <Ionicons
                    name={item.status === 'completed' ? 'checkmark-circle' : 'time-outline'}
                    size={18}
                    color={item.status === 'completed' ? colors.success : colors.primary}
                  />
                </View>
                <View style={styles.insightTextContent}>
                  <Text style={styles.insightRowTitle}>{formatHistoryMeta(item, analysisByAssessment[item.id])}</Text>
                  <Text style={styles.insightRowDesc} numberOfLines={1}>
                    {(item.status || 'pending')} | {item.started_at ? new Date(item.started_at).toLocaleString() : 'Unknown date'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={'#94A3B8'} />
              </Pressable>
            ))
          )}
        </View>
      </Animated.View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: responsiveSize.lg },
  bottomSpacer: { height: responsiveSize.xxl * 2 },

  headerContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl, marginTop: responsiveSize.md,
  },
  headerTextContainer: {},
  greetingText: { fontSize: fontSize.h4, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 },
  dateText: { fontSize: fontSize.body, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.2 },
  logoutButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6,
  },

  heroCard: {
    borderRadius: 24, padding: responsiveSize.xl, minHeight: 180,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  heroMainContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: responsiveSize.lg },
  heroScore: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  heroLabel: { color: 'rgba(255,255,255,0.95)', fontSize: fontSize.body, fontWeight: '600', letterSpacing: 0.2 },
  heroMoodLabel: { marginTop: 8, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  heroFooter: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.small, textAlign: 'center', letterSpacing: 0.1 },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.lg,
    gap: responsiveSize.md,
  },
  quickActionButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  primaryAction: { backgroundColor: colors.primary },
  secondaryAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  actionIcon: { marginRight: 8 },
  actionTitlePrimary: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  actionTitleSecondary: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },

  sectionTitle: {
    fontSize: fontSize.h6, fontWeight: '700', color: colors.textPrimary,
    marginLeft: responsiveSize.lg, marginBottom: responsiveSize.md, letterSpacing: 0.3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSize.lg,
    marginBottom: responsiveSize.xl,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: responsiveSize.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  metricValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 4 },
  metricSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  sectionContainer: { paddingHorizontal: responsiveSize.lg, marginBottom: responsiveSize.xl },
  cardHeader: { marginBottom: responsiveSize.sm },

  warningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  warningTitle: { marginLeft: 10, color: colors.danger, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  warningText: { color: '#991B1B', fontSize: 13, lineHeight: 21, marginBottom: 6, letterSpacing: 0.1 },

  disclaimerCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: responsiveSize.lg, marginBottom: responsiveSize.lg,
    shadowColor: '#A16207', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  disclaimerHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  disclaimerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FED7AA',
  },
  disclaimerTitle: { fontSize: 13, fontWeight: '800', color: '#9A3412', marginLeft: 8, letterSpacing: 0.2 },
  disclaimerText: { fontSize: 12.5, color: '#9A3412', lineHeight: 19, letterSpacing: 0.1 },

  insightListContainer: {
    backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    padding: responsiveSize.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: responsiveSize.base },
  insightBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: responsiveSize.lg, marginBottom: responsiveSize.base },
  insightIconCircle: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center', justifyContent: 'center', marginRight: responsiveSize.md,
  },
  insightTextContent: { flex: 1, marginRight: responsiveSize.sm },
  insightRowTitle: { fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary, marginBottom: 4, letterSpacing: 0.2 },
  insightRowDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, letterSpacing: 0.1 },
  emptyInsights: { alignItems: 'center', padding: 32 },
  emptyInsightsText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 16, lineHeight: 21, letterSpacing: 0.1 },

});
