import React, { useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { AuthContext } from '../context/AuthContext';
import { responsiveSize, fontSize, borderRadius } from '../utils/responsive';

const Logo = require('../../assets/logo.jpg');
const { width } = Dimensions.get("window");

export const SignupScreen = () => {
  const navigation = useNavigation();
  const { signup, isLoading, error: authError } = useContext(AuthContext);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
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
    
    const result = await signup(email, password, confirmPassword); // Assuming signup handles name too? If not, adjust context.
    if (result.success) {
      console.log('Signup successful!');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background Decoration */}
      <View style={styles.backgroundContainer}>
         <View style={[styles.blob, styles.blobTop]} />
         <View style={[styles.blob, styles.blobBottom]} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View 
            entering={FadeIn.duration(1000)} 
            style={styles.headerContainer}
        >
          <View style={styles.logoWrapper}>
             <Image source={Logo} style={styles.logo} />
          </View>
          
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join MindSentry today</Text>
        </Animated.View>

        <Animated.View 
            entering={SlideInDown.duration(800).delay(200)} 
            style={styles.formContainer}
        >
            {/* Full Name Input */}
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={[styles.inputContainer, validationError && !name && styles.inputErrorBorder]}>
                    <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor={colors.textSecondary + '80'}
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            setValidationError('');
                        }}
                        editable={!isLoading}
                    />
                </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={[styles.inputContainer, validationError && !email && styles.inputErrorBorder]}>
                    <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="hello@example.com"
                        placeholderTextColor={colors.textSecondary + '80'}
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            setValidationError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!isLoading}
                    />
                </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, validationError && !password && styles.inputErrorBorder]}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Create a password"
                        placeholderTextColor={colors.textSecondary + '80'}
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            setValidationError('');
                        }}
                        secureTextEntry={!isPasswordVisible}
                        editable={!isLoading}
                    />
                    <Pressable onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
                        <Ionicons 
                            name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                            size={20} 
                            color={colors.textSecondary} 
                        />
                    </Pressable>
                </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={[styles.inputContainer, validationError && (confirmPassword !== password) && styles.inputErrorBorder]}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm your password"
                        placeholderTextColor={colors.textSecondary + '80'}
                        value={confirmPassword}
                        onChangeText={(text) => {
                            setConfirmPassword(text);
                            setValidationError('');
                        }}
                        secureTextEntry={!isConfirmPasswordVisible}
                        editable={!isLoading}
                    />
                    <Pressable onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} style={styles.eyeIcon}>
                        <Ionicons 
                            name={isConfirmPasswordVisible ? "eye-off-outline" : "eye-outline"} 
                            size={20} 
                            color={colors.textSecondary} 
                        />
                    </Pressable>
                </View>
            </View>

            {/* Error Message */}
            {(authError || validationError) ? (
                <Animated.View entering={FadeIn} style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{authError || validationError}</Text>
                </Animated.View>
            ) : <View style={styles.errorPlaceholder} />}

            {/* Sign Up Button */}
            <Pressable 
                onPress={handleSignup} 
                style={({ pressed }) => [styles.buttonShadow, pressed && styles.buttonPressed]}
                disabled={isLoading}
            >
                <LinearGradient
                    colors={[colors.primary, '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Sign Up</Text>
                    )}
                </LinearGradient>
            </Pressable>

            {/* Footer Links */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.linkText}>Log In</Text>
                </Pressable>
            </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
  },
  blob: {
    position: 'absolute',
    width: width * 1.0,
    height: width * 1.0,
    borderRadius: width * 0.5,
    opacity: 0.05,
  },
  blobTop: {
    top: -width * 0.4,
    left: -width * 0.2,
    backgroundColor: colors.secondary,
  },
  blobBottom: {
    bottom: -width * 0.4,
    right: -width * 0.2,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: responsiveSize.lg,
    paddingTop: 60, // Extra space for top
  },

  // --- Header ---
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // --- Form ---
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
  },
  inputErrorBorder: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: 8,
  },

  // --- Errors ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  errorPlaceholder: {
    height: 0,
    marginBottom: 20,
  },

  // --- Buttons ---
  buttonShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderRadius: 14,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  gradientButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // --- Footer ---
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginRight: 4,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});