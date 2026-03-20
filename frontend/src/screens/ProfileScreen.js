import React, { useContext, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { SectionHeader } from '../components/SectionHeader';
import { ErrorBox } from '../components/ErrorBox';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize } from '../utils/responsive';

export const ProfileScreen = ({ navigation }) => {
  const { user, signout } = useContext(AuthContext);
  const [screenError, setScreenError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = useMemo(() => {
    const name = user?.name || 'User';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';
  }, [user]);

  const actionItems = [
    { key: 'chat', title: 'AI Counselor Chat', subtitle: 'Continue your conversation', icon: 'chatbubbles-outline', onPress: () => navigation.navigate('CounselorChat') },
    { key: 'history', title: 'Analysis History', subtitle: 'View sessions and insights', icon: 'time-outline', onPress: () => navigation.navigate('Insights') },
    { key: 'support', title: 'Support & Resources', subtitle: 'Get help and crisis resources', icon: 'heart-outline', onPress: () => navigation.navigate('Support') },
    { key: 'capture', title: 'Capture Data', subtitle: 'Run voice and face capture', icon: 'scan-outline', onPress: () => navigation.navigate('CaptureScreen') },
    { key: 'checkin', title: 'Daily Check-in', subtitle: 'Start a new wellness check-in', icon: 'create-outline', onPress: () => navigation.navigate('CheckInScreen') },
    { key: 'settings', title: 'Settings', subtitle: 'Notification and privacy controls', icon: 'settings-outline', onPress: () => setScreenError('Settings panel is coming soon.') },
  ];

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setScreenError('');
    const result = await signout();
    if (!result.success) {
      setScreenError(result.error || 'Logout failed. Please try again.');
      setIsLoggingOut(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View>
        <SectionHeader
          title="Profile"
          showBack
          onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
        />
      </Animated.View>

      <View style={styles.errorBoxWrap}>
        <ErrorBox message={screenError} onDismiss={() => setScreenError('')} />
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.nameText}>{user?.name || 'MindSentry User'}</Text>
        <Text style={styles.emailText}>{user?.email || 'No email found'}</Text>
      </View>

      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        {actionItems.map((item) => (
          <Pressable key={item.key} style={styles.actionRow} onPress={item.onPress}>
            <View style={styles.actionIcon}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{item.title}</Text>
              <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>

      <Pressable onPress={handleLogout} style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]} disabled={isLoggingOut}>
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutText}>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: responsiveSize.lg, paddingHorizontal: responsiveSize.lg, paddingBottom: responsiveSize.lg },
  errorBoxWrap: { marginBottom: 12 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    marginBottom: responsiveSize.lg,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  nameText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  emailText: { marginTop: 4, fontSize: 13, color: colors.textSecondary },
  actionSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    marginBottom: responsiveSize.lg,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '14',
    marginRight: 12,
  },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  actionSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  logoutButton: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoutButtonDisabled: { opacity: 0.75 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
});
