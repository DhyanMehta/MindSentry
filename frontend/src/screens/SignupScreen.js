import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Logo = require('../../assets/logo.jpg');

export const SignupScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = () => {
    // TODO: Integrate with backend registration
    console.log('Signup attempt with:', { email, password, confirmPassword });
    // Simulate successful signup
    navigation.replace('MainTabs');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0} // Adjust as needed
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        <Animated.View entering={SlideInDown.duration(800).delay(500)} style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(800).delay(600)} style={styles.buttonGroup}>
          <Pressable onPress={handleSignup} style={styles.button}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
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
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 15,
    color: colors.textPrimary,
    ...typography.body,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  linkButton: {
    paddingVertical: 10,
  },
  linkButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: '600',
  },
});
