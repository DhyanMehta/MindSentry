import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { responsiveSize, fontSize } from '../utils/responsive';
import { ApiService } from '../services/api';

const ActionCard = ({ icon, title, description, onPress, color, filled = false, delay = 0, loading = false }) => (
  <Animated.View entering={FadeInDown.delay(delay)}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        filled ? [styles.actionCardFilled, { backgroundColor: color }] : styles.actionCardOutlined,
        pressed && styles.actionPressed,
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: filled ? 'rgba(255,255,255,0.18)' : `${color}18` }]}>
        {loading ? <ActivityIndicator size="small" color={filled ? '#fff' : color} /> : <Ionicons name={icon} size={18} color={filled ? '#fff' : color} />}
      </View>
      <View style={styles.actionBody}>
        <Text style={[styles.actionTitle, filled && styles.actionTitleFilled]}>{title}</Text>
        <Text style={[styles.actionDesc, filled && styles.actionDescFilled]}>{description}</Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={filled ? '#fff' : colors.textSecondary} />
    </Pressable>
  </Animated.View>
);

export const SupportScreen = () => {
  const navigation = useNavigation();
  const [screenError, setScreenError] = useState('');
  const [latestSession, setLatestSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLatestSession = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoadingSession(true);
    }
    try {
      const assessments = await ApiService.getHistoryAssessments(3);
      const latestCompleted = (assessments || []).find((item) => item?.status === 'completed');
      if (!latestCompleted?.id) {
        setLatestSession(null);
        return;
      }

      const [analysis, recommendations] = await Promise.all([
        ApiService.getAnalysisResult(latestCompleted.id).catch(() => null),
        ApiService.getRecommendations(latestCompleted.id).catch(() => []),
      ]);

      setLatestSession({
        assessmentId: latestCompleted.id,
        supportLevel: analysis?.support_level || 'low',
        wellnessScore: analysis?.wellness_score ?? null,
        recommendation: Array.isArray(recommendations) && recommendations.length > 0 ? recommendations[0]?.title : null,
      });
    } catch (error) {
      setLatestSession(null);
      setScreenError(error?.message || 'Could not load your latest wellness context.');
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoadingSession(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLatestSession();
  }, [loadLatestSession]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoadingSession) {
        loadLatestSession({ silent: true });
      }
      return undefined;
    }, [isLoadingSession, loadLatestSession])
  );

  const openGeneralChat = () => {
    navigation.navigate('ChatBot', {
      initialPrompt: 'Hi ArogyaAI, help me understand how I am doing today and suggest one practical next step.',
    });
  };

  const openLatestReview = () => {
    navigation.navigate('ChatBot', {
      wellnessContext: latestSession || { source: 'support-screen' },
      initialPrompt: 'Please review my latest wellness status, explain the main insight, and tell me what to focus on next.',
    });
  };

  const handleCrisisCall = async () => {
    try {
      setScreenError('');
      const url = 'tel:988';
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setScreenError('Phone calling is unavailable on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      setScreenError(err?.message || 'Could not open the crisis line right now. Please call 988 manually.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadLatestSession({ silent: true })}
          tintColor={colors.primary}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(350)}>
        <SectionHeader title="Support" showBack={false} />
        <Text style={styles.subHeader}>Talk with ArogyaAI or reach crisis support fast.</Text>
      </Animated.View>

      <View style={styles.errorBoxWrap}>
        <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
      </View>

      <Animated.View entering={FadeInDown.delay(100)}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>ArogyaAI is ready</Text>
          </View>

          <Text style={styles.heroTitle}>ArogyaAI</Text>
          <Text style={styles.heroSubtitle}>
            Your wellness companion for understanding recent results, checking patterns, and choosing the next supportive step.
          </Text>

          <View style={styles.heroPillRow}>
            <View style={styles.heroPill}>
              <Ionicons name="pulse-outline" size={14} color={colors.primary} />
              <Text style={styles.heroPillText}>Grounded in your check-ins</Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={styles.heroPillText}>Supportive, not diagnostic</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.actionsBlock}>
        <ActionCard
          icon="chatbubble-ellipses-outline"
          title="Start a conversation"
          description="Open ArogyaAI with a clean chat and ask about your wellness."
          onPress={openGeneralChat}
          color={colors.primary}
          filled
          delay={180}
        />
        <ActionCard
          icon={isLoadingSession ? 'hourglass-outline' : 'analytics-outline'}
          title="Review my latest check-in"
          description={
            latestSession?.recommendation
              ? `Latest focus: ${latestSession.recommendation}`
              : 'Load your latest completed session into ArogyaAI for a guided explanation.'
          }
          onPress={openLatestReview}
          color={colors.primary}
          delay={260}
          loading={isLoadingSession}
        />
      </View>

      <Animated.View entering={FadeInDown.delay(320)} style={styles.highlightsCard}>
        <Text style={styles.sectionTitle}>What ArogyaAI can help with</Text>
        <View style={styles.highlightRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.highlightText}>Explain your latest score, stress, mood, and modality outputs in plain language.</Text>
        </View>
        <View style={styles.highlightRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.highlightText}>Turn recent check-ins into one clear next action instead of generic advice.</Text>
        </View>
        <View style={styles.highlightRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.highlightText}>Stay grounded in your own MindSentry data rather than giving made-up health claims.</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400)}>
        <View style={styles.crisisCard}>
          <View style={styles.crisisHeader}>
            <View style={styles.crisisIcon}>
              <Ionicons name="warning-outline" size={22} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.crisisTitle}>Need urgent human help?</Text>
              <Text style={styles.crisisSubtitle}>Use live crisis support right away.</Text>
            </View>
          </View>

          <Text style={styles.crisisText}>
            If you feel unsafe, overwhelmed, or at immediate risk, do not wait for the app. Reach a real crisis service now.
          </Text>

          <Pressable onPress={handleCrisisCall} style={({ pressed }) => [styles.crisisButton, pressed && styles.actionPressed]}>
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.crisisButtonText}>Call 988</Text>
          </Pressable>

          <Text style={styles.crisisFootnote}>You can also text 741741 with the word HELLO for crisis support.</Text>
        </View>
      </Animated.View>

      <View style={styles.disclaimerCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.disclaimerText}>
          ArogyaAI provides supportive wellness guidance and should not replace a licensed clinician for diagnosis or treatment.
        </Text>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: responsiveSize.lg },
  errorBoxWrap: { marginBottom: 14 },
  subHeader: {
    marginTop: 6,
    fontSize: fontSize.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 16,
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  heroBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  heroTitle: { fontSize: 30, fontWeight: '900', color: colors.textPrimary, letterSpacing: 0.2 },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  heroPillRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, gap: 10 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  heroPillText: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  actionsBlock: { gap: 12, marginBottom: 18 },
  actionCard: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionCardFilled: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  actionCardOutlined: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  actionTitleFilled: { color: '#fff' },
  actionDesc: { marginTop: 4, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
  actionDescFilled: { color: 'rgba(255,255,255,0.88)' },
  highlightsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  highlightText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  crisisCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.18)',
    marginBottom: 18,
  },
  crisisHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  crisisIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crisisTitle: { fontSize: 16, fontWeight: '800', color: '#991B1B' },
  crisisSubtitle: { fontSize: 12.5, color: '#B91C1C', marginTop: 2 },
  crisisText: { fontSize: 13, lineHeight: 20, color: '#7F1D1D', marginBottom: 14 },
  crisisButton: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  crisisButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  crisisFootnote: { marginTop: 10, fontSize: 12, lineHeight: 18, color: '#991B1B' },
  disclaimerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  disclaimerText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary },
});
