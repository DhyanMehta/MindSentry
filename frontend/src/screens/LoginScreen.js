import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Logo = require('../../assets/logo.jpg');

export const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Dummy credentials for testing
  const DUMMY_EMAIL = 'test@example.com';
  const DUMMY_PASSWORD = 'password123';

  const handleLogin = () => {
    setError(''); // Clear previous errors
    if (email === DUMMY_EMAIL && password === DUMMY_PASSWORD) {
      console.log('Login successful!');
      navigation.replace('MainTabs');
    } else {
      setError('Invalid email/username or password.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.Image
          entering={FadeIn.duration(1000).delay(100)}
          source={Logo}
          style={styles.logo}
        />
        <Animated.Text entering={SlideInDown.duration(800).delay(300)} style={styles.title}>
          Welcome Back
        </Animated.Text>
        <Animated.Text entering={SlideInDown.duration(800).delay(400)} style={styles.subtitle}>
          Log in to continue your journey.
        </Animated.Text>

        <Animated.View entering={SlideInDown.duration(800).delay(500)} style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Email or Username"
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
          {error ? <Animated.Text entering={FadeIn.duration(300)} style={styles.errorText}>{error}</Animated.Text> : null}
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(800).delay(600)} style={styles.buttonGroup}>
          <Pressable onPress={handleLogin} style={styles.button}>
            <Text style={styles.buttonText}>Log In</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Signup')} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Don't have an account? Sign Up</Text>
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
  errorText: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 10,
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
