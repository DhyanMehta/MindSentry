import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_CHART = {
    labels: WEEK_LABELS,
    datasets: [{ data: [50, 50, 50, 50, 50, 50, 50], strokeWidth: 2 }],
};

const RANGE_OPTIONS = [7, 14, 30];

const getChartConfig = (colorHex) => ({
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: () => colorHex,
    labelColor: () => 'rgba(148, 163, 184, 1)',
    style: { borderRadius: 16 },
    propsForDots: { r: '5', strokeWidth: '2', stroke: colorHex, fill: '#ffffff' },
    propsForBackgroundLines: { strokeDasharray: '5, 5', stroke: '#F1F5F9', strokeWidth: 1 },
    fillShadowGradient: colorHex,
    fillShadowGradientOpacity: 0.15,
});

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
    const [detailVisible, setDetailVisible] = useState(false);

    const loadTrend = useCallback(async ({ refresh = false, silent = false } = {}) => {
        if (!silent) {
            if (refresh) setIsRefreshing(true);
            else setIsLoading(true);
        }
        setScreenError('');

        try {
            const [trendData, assessments] = await Promise.all([
                ApiService.getHistoryTrend(rangeDays),
                ApiService.getHistoryAssessments(rangeDays, 0),
            ]);

            const safeAssessments = Array.isArray(assessments) ? assessments : [];
            setTrend(Array.isArray(trendData) ? trendData : []);
            const map = {};
            safeAssessments.forEach((item) => {
                map[item.id] = item.started_at;
            });
            setAssessmentDateMap(map);

            const analysisEntries = await Promise.all(
                safeAssessments.map(async (assessment) => {
                    try {
                        const analysis = await ApiService.getAnalysisResult(assessment.id);
                        return [assessment.id, analysis?.wellness_score ?? null];
                    } catch {
                        return [assessment.id, null];
                    }
                })
            );

            const wellnessMap = {};
            analysisEntries.forEach(([id, score]) => {
                wellnessMap[id] = score;
            });
            setWellnessByAssessment(wellnessMap);
        } catch (error) {
            setScreenError(error.message || 'Unable to load trend analytics right now.');
            setTrend([]);
            setAssessmentDateMap({});
            setWellnessByAssessment({});
        } finally {
            if (!silent) {
                setIsLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [rangeDays]);

    useFocusEffect(
        useCallback(() => {
            loadTrend();
            const interval = setInterval(() => {
                loadTrend({ silent: true });
            }, 20000);
            return () => clearInterval(interval);
        }, [loadTrend])
    );

    useEffect(() => {
        loadTrend();
    }, [rangeDays, loadTrend]);

    const buildLabels = useCallback((slice) => {
        if (!slice || slice.length === 0) return WEEK_LABELS;
        const step = slice.length > 14 ? 5 : slice.length > 7 ? 3 : 1;
        return slice.map((entry, idx) => {
            if (idx % step !== 0 && idx !== slice.length - 1) return '';
            const startedAt = assessmentDateMap[entry.assessment_id];
            if (!startedAt) return '--';
            const d = new Date(startedAt);
            if (Number.isNaN(d.getTime())) return '--';
            return `${d.getDate()}/${d.getMonth() + 1}`;
        });
    }, [assessmentDateMap]);

    const buildChart = useCallback((valueGetter, fallback = 50) => {
        if (!trend || trend.length === 0) return EMPTY_CHART;
        const slice = trend.slice(-rangeDays);
        const data = slice.map((entry) => {
            const value = valueGetter(entry);
            if (value == null || Number.isNaN(Number(value))) return fallback;
            return Math.max(0, Math.min(100, Math.round(Number(value))));
        });
        return { labels: buildLabels(slice), datasets: [{ data, strokeWidth: 2 }] };
    }, [trend, rangeDays, buildLabels]);

    const getStats = useCallback((chartData) => {
        const points = chartData?.datasets?.[0]?.data || [];
        if (!points.length) return { latest: '--', average: '--', min: '--', max: '--', trend: 'Stable' };

        const latest = points[points.length - 1];
        const average = Math.round(points.reduce((acc, cur) => acc + cur, 0) / points.length);
        const min = Math.min(...points);
        const max = Math.max(...points);
        const first = points[0];
        const delta = latest - first;
        const trendLabel = delta > 4 ? 'Improving' : delta < -4 ? 'Declining' : 'Stable';

        return { latest, average, min, max, trend: trendLabel };
    }, []);

    const graphConfigs = useMemo(() => {
        const moodData = buildChart((entry) => entry?.low_mood_score == null ? null : (1 - entry.low_mood_score) * 100);
        const stressData = buildChart((entry) => entry?.stress_score == null ? null : entry.stress_score * 100);
        const focusData = buildChart((entry) => entry?.burnout_score == null ? null : (1 - entry.burnout_score) * 100);
        const wellnessData = buildChart((entry) => {
            const score = wellnessByAssessment[entry?.assessment_id];
            return score == null ? null : score;
        });

        return [
            {
                key: 'wellness',
                title: 'Wellness Score',
                subtitle: 'Overall AI wellness index',
                color: '#7C3AED',
                icon: 'medal-outline',
                data: wellnessData,
                detailHint: 'This combines mood, stress, and burnout patterns into a single wellness index.',
            },
            {
                key: 'mood',
                title: 'Mood Trends',
                subtitle: 'Higher is better',
                color: colors.primary,
                icon: 'happy-outline',
                data: moodData,
                detailHint: 'Tracks how stable and positive your mood has been over time.',
            },
            {
                key: 'stress',
                title: 'Stress Trends',
                subtitle: 'Lower is better',
                color: colors.danger,
                icon: 'pulse-outline',
                data: stressData,
                detailHint: 'Tracks stress load from your recent check-ins and signals.',
            },
            {
                key: 'focus',
                title: 'Focus & Energy',
                subtitle: 'Higher is better',
                color: colors.accent || '#06B6D4',
                icon: 'flash-outline',
                data: focusData,
                detailHint: 'Derived from burnout trend, indicating focus and energy balance.',
            },
        ];
    }, [buildChart, wellnessByAssessment]);

    const chartWidth = screenWidth - (responsiveSize.lg * 2) - (16 * 2);

    const renderChart = (graph) => {
        const stats = getStats(graph.data);
        return (
            <Pressable key={graph.key} onPress={() => { setSelectedGraph(graph); setDetailVisible(true); }} style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                    <View style={[styles.chartIconBox, { backgroundColor: graph.color + '15' }]}>
                        <Ionicons name={graph.icon} size={16} color={graph.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.chartTitle}>{graph.title}</Text>
                        <Text style={styles.chartSubtitle}>{graph.subtitle}</Text>
                    </View>
                    <View style={[styles.trendBadge, { backgroundColor: graph.color + '18' }]}>
                        <Text style={[styles.trendBadgeText, { color: graph.color }]}>{stats.trend}</Text>
                    </View>
                </View>

                <View style={styles.quickStatsRow}>
                    <View style={styles.quickStatItem}>
                        <Text style={styles.quickStatLabel}>Latest</Text>
                        <Text style={styles.quickStatValue}>{stats.latest}</Text>
                    </View>
                    <View style={styles.quickStatItem}>
                        <Text style={styles.quickStatLabel}>Avg</Text>
                        <Text style={styles.quickStatValue}>{stats.average}</Text>
                    </View>
                    <View style={styles.quickStatItem}>
                        <Text style={styles.quickStatLabel}>Range</Text>
                        <Text style={styles.quickStatValue}>{stats.min}-{stats.max}</Text>
                    </View>
                </View>

                <LineChart
                    data={graph.data}
                    width={chartWidth}
                    height={210}
                    chartConfig={getChartConfig(graph.color)}
                    bezier
                    withInnerLines
                    withOuterLines={false}
                    withVerticalLines
                    withShadow
                    style={styles.chartStyle}
                    fromZero
                />
                <Text style={styles.tapHint}>Tap to view detailed analysis</Text>
            </Pressable>
        );
    };

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
                    onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
                />
            </Animated.View>

            <View style={styles.errorBoxWrap}>
                <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
            </View>

            <Text style={styles.introText}>
                Track how your wellness, mood, stress, and focus signals evolve over time.
            </Text>

            <View style={styles.rangeRow}>
                {RANGE_OPTIONS.map((days) => {
                    const active = rangeDays === days;
                    return (
                        <Pressable
                            key={days}
                            onPress={() => setRangeDays(days)}
                            style={[styles.rangePill, active && styles.rangePillActive]}
                        >
                            <Text style={[styles.rangePillText, active && styles.rangePillTextActive]}>{days}D</Text>
                        </Pressable>
                    );
                })}
            </View>

            {graphConfigs.map((graph) => renderChart(graph))}

            <Modal
                visible={detailVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeaderRow}>
                            <View>
                                <Text style={styles.modalTitle}>{selectedGraph?.title || 'Graph Details'}</Text>
                                <Text style={styles.modalSubtitle}>{selectedGraph?.subtitle || ''}</Text>
                            </View>
                            <Pressable onPress={() => setDetailVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        {selectedGraph ? (
                            <>
                                <LineChart
                                    data={selectedGraph.data}
                                    width={screenWidth - (responsiveSize.lg * 2) - 32}
                                    height={260}
                                    chartConfig={getChartConfig(selectedGraph.color)}
                                    bezier
                                    withInnerLines
                                    withOuterLines={false}
                                    withVerticalLines
                                    withShadow
                                    style={styles.modalChartStyle}
                                    fromZero
                                />
                                <Text style={styles.detailHint}>{selectedGraph.detailHint}</Text>

                                <View style={styles.modalStatsGrid}>
                                    {(() => {
                                        const stats = getStats(selectedGraph.data);
                                        return (
                                            <>
                                                <View style={styles.modalStatBox}>
                                                    <Text style={styles.modalStatLabel}>Latest</Text>
                                                    <Text style={styles.modalStatValue}>{stats.latest}</Text>
                                                </View>
                                                <View style={styles.modalStatBox}>
                                                    <Text style={styles.modalStatLabel}>Average</Text>
                                                    <Text style={styles.modalStatValue}>{stats.average}</Text>
                                                </View>
                                                <View style={styles.modalStatBox}>
                                                    <Text style={styles.modalStatLabel}>Minimum</Text>
                                                    <Text style={styles.modalStatValue}>{stats.min}</Text>
                                                </View>
                                                <View style={styles.modalStatBox}>
                                                    <Text style={styles.modalStatLabel}>Maximum</Text>
                                                    <Text style={styles.modalStatValue}>{stats.max}</Text>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>
            </Modal>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { paddingTop: responsiveSize.lg, paddingBottom: responsiveSize.xl },
    errorBoxWrap: { marginHorizontal: responsiveSize.lg },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: fontSize.body },
    introText: {
        marginHorizontal: responsiveSize.lg,
        marginBottom: responsiveSize.lg,
        fontSize: fontSize.body,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginHorizontal: responsiveSize.lg,
        marginBottom: responsiveSize.lg,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },
    chartHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    trendBadge: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    trendBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    quickStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    quickStatItem: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flex: 1,
        marginRight: 8,
    },
    quickStatLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    quickStatValue: {
        fontSize: 13,
        color: colors.textPrimary,
        fontWeight: '800',
        marginTop: 1,
    },
    tapHint: {
        marginTop: 8,
        textAlign: 'right',
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    rangeRow: {
        flexDirection: 'row',
        marginHorizontal: responsiveSize.lg,
        marginBottom: responsiveSize.lg,
        gap: 8,
    },
    rangePill: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#fff',
    },
    rangePillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    rangePillText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    rangePillTextActive: {
        color: '#fff',
    },
    chartIconBox: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    chartTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    chartSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    chartStyle: { marginLeft: -6, marginTop: 6, borderRadius: 16 },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.45)',
        justifyContent: 'center',
        paddingHorizontal: responsiveSize.lg,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    modalSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    modalChartStyle: {
        marginLeft: -6,
        marginTop: 4,
        borderRadius: 16,
    },
    detailHint: {
        marginTop: 8,
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    modalStatsGrid: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    modalStatBox: {
        width: '48.5%',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    modalStatLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
    },
    modalStatValue: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2,
    },
});
