import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, useWindowDimensions, Pressable, Modal } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { ApiService } from '../services/api';
import { responsiveSize, fontSize } from '../utils/responsive';
import { navigateToDashboard } from '../navigation/navigationHelpers';

const RANGE_OPTIONS = [7, 14, 30];

const getChartConfig = (colorHex) => ({
  backgroundColor: colors.surface,
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => colorHex,
  labelColor: () => colors.textMuted,
  propsForDots: { r: '4.5', strokeWidth: '2', stroke: colorHex, fill: colors.card },
  propsForBackgroundLines: { strokeDasharray: '4 6', stroke: '#E2E8F0', strokeWidth: 1 },
  fillShadowGradient: colorHex,
  fillShadowGradientOpacity: 0.12,
});

const sortTrendRows = (rows, assessmentDateMap) => {
  return [...(rows || [])].sort((a, b) => {
    const dateA = new Date(assessmentDateMap[a?.assessment_id] || a?.created_at || 0).getTime();
    const dateB = new Date(assessmentDateMap[b?.assessment_id] || b?.created_at || 0).getTime();
    return dateA - dateB;
  });
};

const getStats = (points) => {
  if (!points.length) return { latest: '--', average: '--', min: '--', max: '--', delta: 0, trend: 'Stable' };
  const latest = points[points.length - 1];
  const average = Math.round(points.reduce((acc, cur) => acc + cur, 0) / points.length);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const delta = latest - points[0];
  const trend = delta > 4 ? 'Improving' : delta < -4 ? 'Declining' : 'Stable';
  return { latest, average, min, max, delta, trend };
};

export const TrendsScreen = () => {
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const [trend, setTrend] = useState([]);
  const [wellnessByAssessment, setWellnessByAssessment] = useState({});
  const [rangeDays, setRangeDays] = useState(7);
  const [assessmentDateMap, setAssessmentDateMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [selectedGraph, setSelectedGraph] = useState(null);

  const loadTrend = useCallback(async ({ refresh = false, silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [trendData, assessments] = await Promise.all([
        ApiService.getHistoryTrend(rangeDays),
        ApiService.getHistoryAssessments(rangeDays, 0),
      ]);

      const safeAssessments = Array.isArray(assessments) ? assessments : [];
      const map = {};
      safeAssessments.forEach((item) => {
        map[item.id] = item.started_at;
      });
      setAssessmentDateMap(map);
      setTrend(Array.isArray(trendData) ? trendData : []);

      const completed = safeAssessments.filter((assessment) => assessment?.status === 'completed');
      const analysisEntries = await Promise.all(
        completed.map(async (assessment) => {
          try {
            const analysis = await ApiService.getAnalysisResult(assessment.id);
            return [assessment.id, analysis?.wellness_score ?? null];
          } catch {
            return [assessment.id, null];
          }
        })
      );

      const nextWellnessMap = {};
      analysisEntries.forEach(([id, score]) => {
        nextWellnessMap[id] = score;
      });
      setWellnessByAssessment(nextWellnessMap);
    } catch (error) {
      setScreenError(error.message || 'Unable to load trend analytics right now.');
      setTrend([]);
      setAssessmentDateMap({});
      setWellnessByAssessment({});
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [rangeDays]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        loadTrend({ silent: true });
      } else {
        loadTrend();
      }
      return undefined;
    }, [isLoading, loadTrend])
  );

  const orderedTrend = useMemo(() => sortTrendRows(trend, assessmentDateMap), [trend, assessmentDateMap]);

  const buildLabels = useCallback((rows) => {
    if (!rows.length) return [];
    const step = rows.length > 14 ? 5 : rows.length > 7 ? 2 : 1;
    return rows.map((entry, idx) => {
      if (idx % step !== 0 && idx !== rows.length - 1) return '';
      const startedAt = assessmentDateMap[entry.assessment_id] || entry.created_at;
      const date = new Date(startedAt || 0);
      if (Number.isNaN(date.getTime())) return '';
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });
  }, [assessmentDateMap]);

  const chartRows = orderedTrend.slice(-rangeDays);
  const chartWidth = Math.max(300, screenWidth - (responsiveSize.lg * 2) - 24);

  const buildChart = useCallback((label, color, icon, subtitle, detailHint, valueGetter) => {
    const dataPoints = chartRows.map((entry) => {
      const value = valueGetter(entry);
      if (value == null || Number.isNaN(Number(value))) return 0;
      return Math.max(0, Math.min(100, Math.round(Number(value))));
    });
    const labels = buildLabels(chartRows);
    const stats = getStats(dataPoints);
    return {
      key: label,
      title: label,
      subtitle,
      color,
      icon,
      detailHint,
      stats,
      data: {
        labels: labels.length ? labels : [''],
        datasets: [{ data: dataPoints.length ? dataPoints : [0], strokeWidth: 3 }],
      },
    };
  }, [buildLabels, chartRows]);

  const graphConfigs = useMemo(() => ([
    buildChart('Wellness Score', '#0F766E', 'pulse-outline', 'Overall balance', 'Combines stress and mood into one recovery-oriented score.', (entry) => wellnessByAssessment[entry?.assessment_id]),
    buildChart('Mood Stability', '#2563EB', 'happy-outline', 'Higher is better', 'Tracks whether your mood pattern is moving toward steadier, healthier ground.', (entry) => entry?.low_mood_score == null ? null : (1 - entry.low_mood_score) * 100),
    buildChart('Stress Load', '#DC2626', 'flash-outline', 'Lower is better', 'Shows how much strain recent check-ins suggest you are carrying.', (entry) => entry?.stress_score == null ? null : entry.stress_score * 100),
    buildChart('Energy & Focus', '#7C3AED', 'sparkles-outline', 'Higher is better', 'Derived from burnout-related trend signals to estimate attention and energy balance.', (entry) => entry?.burnout_score == null ? null : (1 - entry.burnout_score) * 100),
  ]), [buildChart, wellnessByAssessment]);

  const overview = graphConfigs[0]?.stats || { latest: '--', average: '--', trend: 'Stable' };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your trend analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadTrend({ refresh: true })} tintColor={colors.primary} />}
    >
      <Animated.View>
        <SectionHeader
          title="Wellness Trends"
          showBack
          onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigateToDashboard(navigation))}
        />
      </Animated.View>

      <View style={styles.errorBoxWrap}>
        <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{rangeDays}-day pattern snapshot</Text>
        <Text style={styles.heroTitle}>{overview.latest === '--' ? '--' : `${overview.latest}`}</Text>
        <Text style={styles.heroSubtitle}>Latest wellness score with a {overview.trend.toLowerCase()} direction over the selected range.</Text>
        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetricPill}>
            <Text style={styles.heroMetricLabel}>Average</Text>
            <Text style={styles.heroMetricValue}>{overview.average}</Text>
          </View>
          <View style={styles.heroMetricPill}>
            <Text style={styles.heroMetricLabel}>Trend</Text>
            <Text style={styles.heroMetricValue}>{overview.trend}</Text>
          </View>
        </View>
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((days) => {
          const active = rangeDays === days;
          return (
            <Pressable key={days} onPress={() => setRangeDays(days)} style={[styles.rangePill, active && styles.rangePillActive]}>
              <Text style={[styles.rangePillText, active && styles.rangePillTextActive]}>{days}D</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryGrid}>
        {graphConfigs.map((graph) => (
          <View key={`${graph.key}-summary`} style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: `${graph.color}18` }]}>
              <Ionicons name={graph.icon} size={16} color={graph.color} />
            </View>
            <Text style={styles.summaryTitle}>{graph.title}</Text>
            <Text style={styles.summaryValue}>{graph.stats.latest}</Text>
            <Text style={styles.summaryCaption}>{graph.stats.trend}</Text>
          </View>
        ))}
      </View>

      {graphConfigs.map((graph) => (
        <Pressable key={graph.key} style={styles.chartCard} onPress={() => setSelectedGraph(graph)}>
          <View style={styles.chartHeader}>
            <View style={[styles.chartIconWrap, { backgroundColor: `${graph.color}18` }]}>
              <Ionicons name={graph.icon} size={16} color={graph.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>{graph.title}</Text>
              <Text style={styles.chartSubtitle}>{graph.subtitle}</Text>
            </View>
            <View style={[styles.trendPill, { backgroundColor: `${graph.color}14` }]}>
              <Text style={[styles.trendPillText, { color: graph.color }]}>{graph.stats.trend}</Text>
            </View>
          </View>

          <View style={styles.chartCanvas}>
            <LineChart
              data={graph.data}
              width={chartWidth}
              height={220}
              chartConfig={getChartConfig(graph.color)}
              bezier
              withOuterLines={false}
              withShadow
              fromZero
              style={styles.chartStyle}
            />
          </View>

          <View style={styles.chartStatsRow}>
            <View style={styles.chartStatBox}>
              <Text style={styles.chartStatLabel}>Latest</Text>
              <Text style={styles.chartStatValue}>{graph.stats.latest}</Text>
            </View>
            <View style={styles.chartStatBox}>
              <Text style={styles.chartStatLabel}>Average</Text>
              <Text style={styles.chartStatValue}>{graph.stats.average}</Text>
            </View>
            <View style={styles.chartStatBox}>
              <Text style={styles.chartStatLabel}>Range</Text>
              <Text style={styles.chartStatValue}>{graph.stats.min}-{graph.stats.max}</Text>
            </View>
          </View>
        </Pressable>
      ))}

      <Modal visible={!!selectedGraph} transparent animationType="fade" onRequestClose={() => setSelectedGraph(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedGraph?.title}</Text>
                <Text style={styles.modalSubtitle}>{selectedGraph?.subtitle}</Text>
              </View>
              <Pressable onPress={() => setSelectedGraph(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {selectedGraph && (
              <>
                <View style={styles.modalChartCanvas}>
                  <LineChart
                    data={selectedGraph.data}
                    width={Math.max(280, screenWidth - (responsiveSize.lg * 2) - 36)}
                    height={250}
                    chartConfig={getChartConfig(selectedGraph.color)}
                    bezier
                    withOuterLines={false}
                    withShadow
                    fromZero
                    style={styles.modalChartStyle}
                  />
                </View>
                <Text style={styles.modalHint}>{selectedGraph.detailHint}</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: responsiveSize.lg, paddingBottom: responsiveSize.xl },
  errorBoxWrap: { marginHorizontal: responsiveSize.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: fontSize.body },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    marginHorizontal: responsiveSize.lg,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  heroEyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  heroTitle: { marginTop: 10, fontSize: 36, fontWeight: '900', color: colors.textPrimary },
  heroSubtitle: { marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  heroMetricsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroMetricPill: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  heroMetricLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  heroMetricValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 2 },
  rangeRow: { flexDirection: 'row', gap: 8, marginHorizontal: responsiveSize.lg, marginBottom: 16 },
  rangePill: { borderRadius: 18, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  rangePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangePillText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  rangePillTextActive: { color: '#fff' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: responsiveSize.lg, marginBottom: 8 },
  summaryCard: { width: '48.2%', backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.divider, padding: 14, marginBottom: 12 },
  summaryIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  summaryValue: { marginTop: 6, fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  summaryCaption: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  chartCard: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.divider, padding: 16, marginHorizontal: responsiveSize.lg, marginBottom: 16 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  chartIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  chartTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  chartSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  trendPill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  trendPillText: { fontSize: 11, fontWeight: '800' },
  chartCanvas: {
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
    paddingTop: 10,
    paddingRight: 12,
  },
  chartStyle: { borderRadius: 18, marginLeft: -4 },
  chartStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  chartStatBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  chartStatLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  chartStatValue: { marginTop: 3, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', paddingHorizontal: responsiveSize.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.divider },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  modalSubtitle: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
  modalChartCanvas: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
    paddingTop: 10,
    paddingRight: 12,
  },
  modalChartStyle: { borderRadius: 18, marginLeft: -4 },
  modalHint: { marginTop: 10, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
});
