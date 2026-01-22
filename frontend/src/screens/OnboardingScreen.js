import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Logo = require('../../assets/logo.jpg'); // Assuming logo.jpg is directly under assets/

export const OnboardingScreen = () => {
  const navigation = useNavigation();

  const handleGetStarted = () => {
    navigation.replace('MainTabs');
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        entering={FadeIn.duration(1000).delay(200)}
        source={Logo}
        style={styles.logo}
      />
      <Animated.Text entering={SlideInDown.duration(800).delay(500)} style={styles.title}>
        Welcome to MindSentry
      </Animated.Text>
      <Animated.Text entering={SlideInDown.duration(800).delay(700)} style={styles.description}>
        Your AI-powered multi-modal mental well-being monitor.
        Understand your emotional states, stress levels, and behavioral patterns
        through text, voice, and facial expression analysis.
      </Animated.Text>
      <Animated.View entering={SlideInDown.duration(800).delay(900)} style={styles.buttonContainer}>
        <Pressable onPress={handleGetStarted} style={styles.button}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
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
    padding: 24,
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 40,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
