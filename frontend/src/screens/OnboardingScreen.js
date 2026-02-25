import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { 
  FadeIn, 
  SlideInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';

const Logo = require('../../assets/logo.jpg');
const { width } = Dimensions.get('window');

export const OnboardingScreen = () => {
  const navigation = useNavigation();
  
  // Floating animation for the logo
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* 1. Modern Background Decorations */}
      <View style={styles.backgroundContainer}>
        <View style={[styles.blob, styles.blobTop]} />
        <View style={[styles.blob, styles.blobBottom]} />
      </View>

      {/* 2. Main Content */}
      <View style={styles.contentContainer}>
        
        {/* Logo Section */}
        <Animated.View 
            entering={FadeIn.duration(1000)} 
            style={[styles.logoContainer, animatedLogoStyle]}
        >
          <View style={styles.logoWrapper}>
            <Image source={Logo} style={styles.logo} />
          </View>
          {/* subtle shadow ring */}
          <View style={styles.logoShadow} />
        </Animated.View>

        {/* Text Section */}
        <View style={styles.textContainer}>
            <Animated.Text 
                entering={SlideInDown.duration(800).delay(200)} 
                style={styles.title}
            >
                Welcome to{"\n"}
                <Text style={styles.brandName}>MindSentry</Text>
            </Animated.Text>
            
            <Animated.Text 
                entering={SlideInDown.duration(800).delay(400)} 
                style={styles.description}
            >
                Your AI-powered wellness companion. 
                Track your emotional health through voice, facial expressions, and daily journaling.
            </Animated.Text>
        </View>

        {/* Action Section */}
        <Animated.View 
            entering={SlideInDown.duration(800).delay(600)} 
            style={styles.footerContainer}
        >
            <Pressable 
                onPress={handleGetStarted} 
                style={({ pressed }) => [
                    styles.button, 
                    pressed && styles.buttonPressed
                ]}
            >
                <LinearGradient
                    colors={[colors.primary, '#7C3AED']} // Purple to deep violet
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
            </Pressable>

            <Text style={styles.loginLink} onPress={() => navigation.replace('Login')}>
                Already have an account? <Text style={styles.loginLinkBold}>Log in</Text>
            </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Clean off-white
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // --- Background Decoration ---
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    opacity: 0.08,
  },
  blobTop: {
    top: -width * 0.6,
    left: -width * 0.2,
    backgroundColor: colors.primary,
  },
  blobBottom: {
    bottom: -width * 0.5,
    right: -width * 0.3,
    backgroundColor: colors.secondary,
  },

  // --- Layout ---
  contentContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: responsiveSize.xxl,
  },

  // --- Logo ---
  logoContainer: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: responsiveSize.xl,
  },
  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 35, // Modern squircle look
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  logoShadow: {
    position: 'absolute',
    bottom: -20,
    width: 100,
    height: 20,
    borderRadius: 50,
    backgroundColor: colors.primary,
    opacity: 0.1,
    transform: [{ scaleX: 1.5 }],
  },

  // --- Text ---
  textContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 42,
    marginBottom: 16,
  },
  brandName: {
    fontWeight: '900',
    color: colors.primary,
  },
  description: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },

  // --- Footer / Buttons ---
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: responsiveSize.lg,
  },
  button: {
    width: '100%',
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '700',
  },
  loginLink: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: '700',
  },
});