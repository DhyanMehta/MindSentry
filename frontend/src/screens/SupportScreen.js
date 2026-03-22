import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { responsiveSize, fontSize } from '../utils/responsive';
import { mockResources } from '../data/mockData';

// Quick Action Button Component
const QuickActionButton = ({ icon, title, description, onPress, color, delay }) => (
  <Animated.View entering={FadeInDown.delay(delay)}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderLeftColor: color },
        pressed && styles.actionButtonPressed
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  </Animated.View>
);

// Resource Item Component
const ResourceItem = ({ item, onPress, delay }) => (
  <Animated.View entering={FadeInDown.delay(delay)}>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.resourceCard,
        pressed && styles.resourceCardPressed
      ]}
    >
      <View style={[styles.resourceIcon, { backgroundColor: colors.primary + '10' }]}>
        <Ionicons name="book-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.resourceContent}>
        <Text style={styles.resourceTitle}>{item.title}</Text>
        <Text style={styles.resourceDesc} numberOfLines={1}>
          {item.description}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  </Animated.View>
);

export const SupportScreen = () => {
  const navigation = useNavigation();
  const [screenError, setScreenError] = useState('');

  const handleEngageCounselor = () => {
    navigation.navigate('ChatBot');
  };

  const handleFindClinics = () => {
    setScreenError('Clinic finder coming soon. Use the chat to find nearby clinics!');
    setTimeout(() => setScreenError(''), 3000);
  };

  const handleBookAppointment = () => {
    setScreenError('Appointment booking is available through AarogyaAI chat!');
    setTimeout(() => setScreenError(''), 3000);
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
      setScreenError(err.message || 'Could not open dialer. Please call 988 manually.');
    }
  };

  const handleResourcePress = (item) => {
    setScreenError(`"${item.title}" resource is coming soon.`);
    setTimeout(() => setScreenError(''), 3000);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown}>
        <SectionHeader
          title="Support & Resources"
          showBack={false}
        />
        <Text style={styles.subHeader}>24/7 support whenever you need it</Text>
      </Animated.View>

      {/* Error Box */}
      <View style={styles.errorBoxWrap}>
        <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
      </View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 1. MAIN AI CHAT HERO CARD */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Animated.View entering={FadeInDown.delay(100)}>
        <LinearGradient
          colors={[colors.secondary, '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainChatCard}
        >
          {/* Status Badge */}
          <View style={styles.cardBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>AarogyaAI Online</Text>
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Ionicons name="chatbubbles-outline" size={40} color="#FFFFFF" />
            <Text style={styles.cardTitle}>AarogyaAI Wellness Assistant</Text>
            <Text style={styles.cardDescription}>
              Get personalized support using advanced AI. AarogyaAI analyzes your wellness data to provide empathetic, context-aware guidance.
            </Text>
          </View>

          {/* Action Button */}
          <Pressable
            onPress={handleEngageCounselor}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed
            ]}
          >
            <Text style={styles.primaryButtonText}>Start Chat</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.secondary} />
          </Pressable>

          {/* Features List */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.featureText}>Context-Aware Responses</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.featureText}>Find Clinics & Book Appointments</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.featureText}>Available 24/7</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2. QUICK ACTIONS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <QuickActionButton
          icon="location-outline"
          title="Find Clinics"
          description="Locate nearby health clinics and services"
          onPress={handleFindClinics}
          color="#EF4444"
          delay={200}
        />
        <QuickActionButton
          icon="calendar-outline"
          title="Book Appointment"
          description="Schedule an appointment at your preferred clinic"
          onPress={handleBookAppointment}
          color="#3B82F6"
          delay={300}
        />
      </View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 3. CRISIS EMERGENCY */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Animated.View entering={FadeInDown.delay(400)}>
        <LinearGradient
          colors={['#FEE2E2', '#FECACA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.crisisCard}
        >
          <View style={styles.crisisHeader}>
            <View style={styles.crisisIcon}>
              <Ionicons name="alert-circle" size={24} color="#DC2626" />
            </View>
            <View style={styles.crisisContent}>
              <Text style={styles.crisisTitle}>In Crisis?</Text>
              <Text style={styles.crisisSubtitle}>Get immediate help</Text>
            </View>
          </View>

          <Text style={styles.crisisText}>
            If you or someone you know is in immediate danger, please reach out for help right now.
          </Text>

          <Pressable
            onPress={handleCrisisCall}
            style={({ pressed }) => [
              styles.crisisButton,
              pressed && styles.crisisButtonPressed
            ]}
          >
            <Ionicons name="call" size={18} color="#DC2626" />
            <Text style={styles.crisisButtonText}>Call Crisis Line (988)</Text>
          </Pressable>

          <View style={styles.alternativeHelp}>
            <Text style={styles.alternativeText}>
              💬 Also available: Text "HELLO" to 741741
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 4. SELF-HELP RESOURCES */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View style={styles.resourcesSection}>
        <View style={styles.resourcesHeader}>
          <Text style={styles.sectionTitle}>Self-Help Resources</Text>
          <Text style={styles.resourcesSubtitle}>Learn more about wellness</Text>
        </View>

        <View style={styles.resourcesList}>
          {mockResources.slice(0, 4).map((item, idx) => (
            <ResourceItem
              key={idx}
              item={item}
              onPress={() => handleResourcePress(item)}
              delay={500 + (idx * 100)}
            />
          ))}
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 5. FOOTER DISCLAIMER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View style={styles.disclaimerSection}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.disclaimerText}>
          MindSentry is not a replacement for professional medical advice. Always consult with healthcare providers for diagnosis and treatment.
        </Text>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
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
  errorBoxWrap: {
    marginBottom: 16,
  },
  subHeader: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },

  // ═════════════════════════════════════════
  // MAIN CHAT CARD
  // ═════════════════════════════════════════
  mainChatCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
  featuresList: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // ═════════════════════════════════════════
  // QUICK ACTIONS
  // ═════════════════════════════════════════
  quickActionsSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.98 }],
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  actionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  // ═════════════════════════════════════════
  // CRISIS CARD
  // ═════════════════════════════════════════
  crisisCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 2,
    borderColor: '#FCA5A5',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  crisisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  crisisIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crisisContent: {
    flex: 1,
  },
  crisisTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  crisisSubtitle: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
  },
  crisisText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    marginBottom: 14,
  },
  crisisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#EF4444',
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  crisisButtonPressed: {
    backgroundColor: '#FEF2F2',
    transform: [{ scale: 0.96 }],
  },
  crisisButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  alternativeHelp: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  alternativeText: {
    fontSize: 12,
    color: '#7F1D1D',
    fontWeight: '500',
  },

  // ═════════════════════════════════════════
  // RESOURCES
  // ═════════════════════════════════════════
  resourcesSection: {
    marginBottom: 28,
  },
  resourcesHeader: {
    marginBottom: 14,
  },
  resourcesSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
  },
  resourcesList: {
    gap: 10,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  resourceCardPressed: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.primary,
  },
  resourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resourceContent: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resourceDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ═════════════════════════════════════════
  // FOOTER
  // ═════════════════════════════════════════
  disclaimerSection: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
});