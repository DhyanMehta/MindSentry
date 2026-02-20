import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize, imageDimensions, inputDimensions, buttonDimensions, borderRadius, isTablet, cardDimensions, shadows } from '../utils/responsive';

const Logo = require('../../assets/logo.jpg');

export const SignupScreen = () => {
  const navigation = useNavigation();
  const { signup, isLoading, error: authError } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const validateInputs = () => {
    setValidationError('');
    
    if (!name.trim()) {
      setValidationError('Please enter your full name');
      return false;
    }
    
    if (!email.trim()) {
      setValidationError('Please enter your email');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    
    if (!password) {
      setValidationError('Please enter a password');
      return false;
    }
    
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }
    
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSignup = async () => {
    if (!validateInputs()) return;
    
    const result = await signup(email, password, name);
    
    if (result.success) {
      // Navigation is handled by AppNavigator based on auth state
      console.log('Signup successful!');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={false}>
        <Animated.Image
          entering={FadeIn.duration(1000).delay(100)}
          source={Logo}
          style={styles.logo}
        />
        <Animated.Text entering={SlideInDown.duration(800).delay(300)} style={styles.title}>
          Join MindSentry
        </Animated.Text>
        <Animated.Text entering={SlideInDown.duration(800).delay(400)} style={styles.subtitle}>
          Create an account to get started.
        </Animated.Text>

        <Animated.View entering={SlideInDown.duration(800).delay(500)} style={styles.formCard}>
          <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, validationError && !name && styles.inputError]}
            placeholder="Full Name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setValidationError('');
            }}
            editable={!isLoading}
          />
          <TextInput
            style={[styles.input, validationError && !email && styles.inputError]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setValidationError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TextInput
            style={[styles.input, validationError && !password && styles.inputError]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setValidationError('');
            }}
            secureTextEntry
            editable={!isLoading}
          />
          <TextInput
            style={[styles.input, validationError && !confirmPassword && styles.inputError]}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setValidationError('');
            }}
            secureTextEntry
            editable={!isLoading}
          />
            {(authError || validationError) && (
              <Animated.Text entering={FadeIn.duration(300)} style={styles.errorText}>
                {authError || validationError}
              </Animated.Text>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(800).delay(600)} style={styles.buttonGroup}>
          <Pressable 
            onPress={handleSignup} 
            style={[styles.button, isLoading && styles.buttonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </Pressable>

          <Pressable 
            onPress={() => navigation.navigate('Login')} 
            style={styles.linkButton}
            disabled={isLoading}
          >
            <Text style={styles.linkButtonText}>Already have an account? Log In</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsiveSize.base,
    paddingVertical: responsiveSize.lg,
  },
  logo: {
    width: imageDimensions.avatarLarge,
    height: imageDimensions.avatarLarge,
    resizeMode: 'contain',
    marginBottom: isTablet() ? 56 : responsiveSize.lg,
  },
  title: {
    ...typography.h1,
    fontSize: fontSize.h2,
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: responsiveSize.lg,
    fontSize: fontSize.body,
  },
  inputGroup: {
    width: '100%',
    maxWidth: isTablet() ? 500 : 350,
    marginBottom: responsiveSize.base,
  },
  formCard: {
    width: '100%',
    maxWidth: isTablet() ? 520 : 360,
    backgroundColor: colors.card,
    padding: cardDimensions.padding,
    borderRadius: borderRadius.extraLarge,
    marginBottom: responsiveSize.lg,
    ...shadows.medium,
  },
  input: {
    width: '100%',
    height: inputDimensions.height,
    backgroundColor: colors.card,
    borderRadius: borderRadius.medium,
    paddingHorizontal: inputDimensions.paddingHorizontal,
    color: colors.textPrimary,
    ...typography.body,
    marginBottom: inputDimensions.marginBottom,
    borderWidth: 1,
    borderColor: colors.divider,
    fontSize: fontSize.body,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.card,
  },
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: responsiveSize.md,
    fontSize: fontSize.small,
  },
  buttonGroup: {
    width: '100%',
    maxWidth: isTablet() ? 500 : 350,
    alignItems: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: buttonDimensions.paddingVertical,
    paddingHorizontal: buttonDimensions.paddingHorizontal,
    borderRadius: borderRadius.medium,
    width: '100%',
    alignItems: 'center',
    marginBottom: responsiveSize.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.body,
  },
  linkButton: {
    paddingVertical: responsiveSize.md,
  },
  linkButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
    fontSize: fontSize.body,
  },
});
