import React, { useState, useContext } from "react";
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
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { AuthContext } from "../context/AuthContext";
import { responsiveSize, fontSize, borderRadius } from "../utils/responsive";

const Logo = require("../../assets/logo.jpg");
const { width } = Dimensions.get("window");

export const LoginScreen = () => {
  const navigation = useNavigation();
  const { signin, isLoading, error: authError } = useContext(AuthContext);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [validationError, setValidationError] = useState("");

  const validateInputs = () => {
    setValidationError("");

    if (!email.trim()) {
      setValidationError("Please enter your email");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError("Please enter a valid email address");
      return false;
    }

    if (!password) {
      setValidationError("Please enter your password");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    const result = await signin(email, password);
    if (result.success) {
      console.log("Login successful!");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your wellness journey</Text>
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(800).delay(200)}
          style={styles.formContainer}
        >
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
                        setValidationError("");
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
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textSecondary + '80'}
                    value={password}
                    onChangeText={(text) => {
                        setPassword(text);
                        setValidationError("");
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

          {/* Error Message */}
          {(authError || validationError) ? (
            <Animated.View entering={FadeIn} style={styles.errorContainer}>
               <Ionicons name="alert-circle" size={16} color={colors.danger} />
               <Text style={styles.errorText}>{authError || validationError}</Text>
            </Animated.View>
          ) : <View style={styles.errorPlaceholder} />}

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
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
                    <Text style={styles.buttonText}>Log In</Text>
                )}
            </LinearGradient>
          </Pressable>

          {/* Footer Links */}
          <View style={styles.footer}>
             <Text style={styles.footerText}>Don't have an account?</Text>
             <Pressable onPress={() => navigation.navigate("Signup")}>
                 <Text style={styles.linkText}>Sign Up</Text>
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
    right: -width * 0.2,
    backgroundColor: colors.primary,
  },
  blobBottom: {
    bottom: -width * 0.4,
    left: -width * 0.2,
    backgroundColor: colors.secondary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: responsiveSize.lg,
  },
  
  // --- Header ---
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 24,
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
    resizeMode: "contain",
  },
  title: {
    fontSize: 28,
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
    marginBottom: 20,
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