import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, useWindowDimensions, Pressable } from 'react-native';
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
    const [rangeDays, setRangeDays] = useState(7);
    const [assessmentDateMap, setAssessmentDateMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [screenError, setScreenError] = useState('');

    const loadTrend = useCallback(async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);
        setScreenError('');

        try {
            const [trendData, assessments] = await Promise.all([
                ApiService.getHistoryTrend(rangeDays),
                ApiService.getHistoryAssessments(rangeDays, 0),
            ]);
            setTrend(Array.isArray(trendData) ? trendData : []);
            const map = {};
            (Array.isArray(assessments) ? assessments : []).forEach((item) => {
                map[item.id] = item.started_at;
            });
            setAssessmentDateMap(map);
        } catch (error) {
            setScreenError(error.message || 'Unable to load trend analytics right now.');
            setTrend([]);
            setAssessmentDateMap({});
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [rangeDays]);

    useFocusEffect(
        useCallback(() => {
            loadTrend();
        }, [loadTrend])
    );

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

    const buildChart = useCallback((field, invert = false) => {
        if (!trend || trend.length === 0) return EMPTY_CHART;
        const slice = trend.slice(-rangeDays);
        const data = slice.map((entry) => {
            if (!entry || entry[field] == null) return 50;
            const val = invert ? 1 - entry[field] : entry[field];
            return Math.max(0, Math.round(val * 100));
        });
        return { labels: buildLabels(slice), datasets: [{ data, strokeWidth: 2 }] };
    }, [trend, rangeDays, buildLabels]);

    const chartWidth = screenWidth - (responsiveSize.lg * 2) - (16 * 2);

    const renderChart = (title, subtitle, data, color) => (
        <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
                <View style={[styles.chartIconBox, { backgroundColor: color + '15' }]}>
                    <Ionicons name="analytics" size={16} color={color} />
                </View>
                <View>
                    <Text style={styles.chartTitle}>{title}</Text>
                    <Text style={styles.chartSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <LineChart
                data={data}
                width={chartWidth}
                height={220}
                chartConfig={getChartConfig(color)}
                bezier
                withInnerLines
                withOuterLines={false}
                withVerticalLines
                withShadow
                style={styles.chartStyle}
                fromZero
            />
        </View>
    );

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
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadTrend(true)} tintColor={colors.primary} />}
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
                Track how your stress, mood, and focus signals evolve over time.
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

            {renderChart('Mood Trends', 'Higher is better', buildChart('low_mood_score', true), colors.primary)}
            {renderChart('Stress Trends', 'Lower is better', buildChart('stress_score', false), colors.danger)}
            {renderChart('Focus & Energy', 'Higher is better', buildChart('burnout_score', true), colors.accent || '#06B6D4')}

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
});
