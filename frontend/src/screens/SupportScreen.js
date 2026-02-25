import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { responsiveSize, fontSize } from '../utils/responsive';
import { mockResources } from '../data/mockData';

// Helper component for individual resource items
const ResourceItem = ({ item, onPress, delay }) => (
  <Animated.View 
    entering={SlideInDown.duration(600).delay(delay)} 
    style={styles.resourceCardContainer}
  >
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.resourceCard, 
        pressed && styles.resourceCardPressed
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name="book-outline" size={24} color={colors.primary} />
      </View>
      <View style={styles.resourceContent}>
        <Text style={styles.resourceTitle}>{item.title}</Text>
        <Text style={styles.resourceDesc} numberOfLines={2}>
          {item.description || "Tap to view this helpful resource."}
        </Text>
        <View style={styles.badgeRow}>
           <View style={styles.badge}>
             <Ionicons name="wifi" size={10} color={colors.success} style={{marginRight: 4}} />
             <Text style={styles.badgeText}>Available Offline</Text>
           </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  </Animated.View>
);

export const SupportScreen = () => {
  const navigation = useNavigation();

  const handleSupportCardPress = (item) => {
    // Placeholder for actual navigation or link opening
    console.log('Tapped resource:', item.title);
  };

  const handleEngageCounselor = () => {
    navigation.navigate('CounselorChat');
  };

  const handleCrisisCall = () => {
    // Opens the phone dialer with the crisis number
    Linking.openURL('tel:988'); 
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={SlideInDown.duration(600).delay(100)} style={styles.headerContainer}>
        <SectionHeader title="Support & Resources" />
        <Text style={styles.subHeader}>Get help when you need it most.</Text>
      </Animated.View>

      {/* 1. AI Counselor Hero Card */}
      <Animated.View entering={SlideInDown.duration(600).delay(200)}>
        <LinearGradient
            colors={[colors.secondary, '#6366f1']} // Indigo gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiCard}
        >
            <View style={styles.aiHeader}>
                <View style={styles.aiIconCircle}>
                    <Ionicons name="chatbubbles" size={24} color={colors.secondary} />
                </View>
                <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Online Now</Text>
                </View>
            </View>
            
            <Text style={styles.aiTitle}>Chat with AI Counselor</Text>
            <Text style={styles.aiDesc}>
                Feeling overwhelmed? Get instant, empathetic support and personalized coping strategies, 24/7.
            </Text>

            <Pressable 
                onPress={handleEngageCounselor} 
                style={({ pressed }) => [styles.engageButton, pressed && { opacity: 0.9 }]}
            >
                <Text style={styles.engageButtonText}>Start Conversation</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.secondary} />
            </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* 2. Crisis / Emergency Banner */}
      <Animated.View entering={SlideInDown.duration(600).delay(300)} style={styles.crisisContainer}>
         <View style={styles.crisisBorder} />
         <View style={styles.crisisContent}>
             <View style={styles.crisisHeader}>
                 <Ionicons name="warning" size={20} color={colors.danger} />
                 <Text style={styles.crisisTitle}>In Crisis?</Text>
             </View>
             <Text style={styles.crisisText}>
                 If you or someone you know is in immediate danger, please reach out for help immediately.
             </Text>
             <Pressable onPress={handleCrisisCall} style={styles.crisisButton}>
                 <Text style={styles.crisisButtonText}>Call Crisis Line (988)</Text>
             </Pressable>
         </View>
      </Animated.View>

      {/* 3. Resources List */}
      <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Self-Help Library</Text>
      </View>

      <View style={styles.resourcesList}>
        {mockResources.map((item, idx) => (
            <ResourceItem 
                key={idx} 
                item={item} 
                onPress={() => handleSupportCardPress(item)} 
                delay={400 + (idx * 100)} 
            />
        ))}
      </View>

      {/* 4. Disclaimer Footer */}
      <Animated.View entering={FadeIn.delay(800)} style={styles.footerContainer}>
        <Ionicons name="medical-outline" size={20} color={colors.textSecondary} style={{marginBottom: 8}} />
        <Text style={styles.disclaimerText}>
            This app is not a replacement for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.
        </Text>
      </Animated.View>
      
      <View style={{ height: 40 }} />
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
  headerContainer: {
    marginBottom: responsiveSize.lg,
  },
  subHeader: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // --- AI Counselor Card ---
  aiCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80', // bright green
    marginRight: 6,
  },
  onlineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  aiTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aiDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: 24,
  },
  engageButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  engageButtonText: {
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 16,
  },

  // --- Crisis Banner ---
  crisisContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2', // Very light red
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  crisisBorder: {
    width: 6,
    backgroundColor: colors.danger,
  },
  crisisContent: {
    flex: 1,
    padding: 16,
  },
  crisisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  crisisTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  crisisText: {
    fontSize: 14,
    color: '#7F1D1D', // Dark red text
    lineHeight: 20,
    marginBottom: 12,
  },
  crisisButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  crisisButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },

  // --- Resources ---
  sectionTitleRow: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resourcesList: {
    gap: 16,
  },
  resourceCardContainer: {
    marginBottom: 4,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resourceCardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  resourceContent: {
    flex: 1,
    marginRight: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  resourceDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4', // Light green bg
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '600',
  },

  // --- Footer ---
  footerContainer: {
    marginTop: 32,
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});