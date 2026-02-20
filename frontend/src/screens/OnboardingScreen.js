import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import {
  responsiveSize,
  imageDimensions,
  borderRadius,
  cardDimensions,
  shadows,
  isTablet,
  fontSize,
} from '../utils/responsive';

const Logo = require('../../assets/logo.jpg'); // Assuming logo.jpg is directly under assets/

export const OnboardingScreen = () => {
  const navigation = useNavigation();

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.decorativeBackground} />
      <Animated.View entering={FadeIn.duration(800).delay(150)} style={styles.card}>
        <Animated.Image
          entering={FadeIn.duration(1000).delay(200)}
          source={Logo}
          style={styles.logo}
        />
        <Animated.Text entering={SlideInDown.duration(800).delay(300)} style={styles.title}>
          Welcome to MindSentry
        </Animated.Text>
        <Animated.Text entering={SlideInDown.duration(800).delay(450)} style={styles.description}>
          Your AI-powered multi-modal mental well-being monitor.
          Understand your emotional states, stress levels, and behavioral patterns
          through text, voice, and facial expression analysis.
        </Animated.Text>

        <Animated.View entering={SlideInDown.duration(800).delay(650)} style={styles.buttonContainer}>
          <Pressable onPress={handleGetStarted} style={styles.button}>
            <Text style={styles.buttonText}>Get Started</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  decorativeBackground: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: colors.primaryTint,
    opacity: 0.9,
  },
  card: {
    width: '100%',
    maxWidth: isTablet() ? 640 : 420,
    backgroundColor: colors.card,
    padding: cardDimensions.padding,
    borderRadius: borderRadius.extraLarge,
    alignItems: 'center',
    ...shadows.large,
  },
  logo: {
    width: imageDimensions.avatarLarge,
    height: imageDimensions.avatarLarge,
    resizeMode: 'contain',
    marginBottom: responsiveSize.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    color: colors.textPrimary,
    marginBottom: responsiveSize.md,
    textAlign: 'center',
    fontWeight: '800',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: responsiveSize.lg,
    lineHeight: 24,
    maxWidth: '92%',
    fontSize: fontSize.body,
  },
  buttonContainer: {
    marginTop: responsiveSize.md,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: responsiveSize.md,
    paddingHorizontal: responsiveSize.xl,
    borderRadius: borderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.body,
  },
});
