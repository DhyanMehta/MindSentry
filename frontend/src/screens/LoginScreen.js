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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import { AuthContext } from "../context/AuthContext";
import {
  responsiveSize,
  fontSize,
  imageDimensions,
  inputDimensions,
  buttonDimensions,
  borderRadius,
  isTablet,
} from "../utils/responsive";

const Logo = require("../../assets/logo.jpg");

export const LoginScreen = () => {
  const navigation = useNavigation();
  const { signin, isLoading, error: authError } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    const result = await signin(email, password);

    if (result.success) {
      // Navigation is handled by AppNavigator based on auth state
      console.log("Login successful!");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={false}
      >
        <Animated.Image
          entering={FadeIn.duration(1000).delay(100)}
          source={Logo}
          style={styles.logo}
        />
        <Animated.Text
          entering={SlideInDown.duration(800).delay(300)}
          style={styles.title}
        >
          Welcome
        </Animated.Text>
        <Animated.Text
          entering={SlideInDown.duration(800).delay(400)}
          style={styles.subtitle}
        >
          Log in to continue your journey.
        </Animated.Text>

        <Animated.View
          entering={SlideInDown.duration(800).delay(500)}
          style={styles.inputGroup}
        >
          <TextInput
            style={[
              styles.input,
              validationError && !email && styles.inputError,
            ]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setValidationError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TextInput
            style={[
              styles.input,
              validationError && !password && styles.inputError,
            ]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setValidationError("");
            }}
            secureTextEntry
            editable={!isLoading}
          />
          {(authError || validationError) && (
            <Animated.Text
              entering={FadeIn.duration(300)}
              style={styles.errorText}
            >
              {authError || validationError}
            </Animated.Text>
          )}
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(800).delay(600)}
          style={styles.buttonGroup}
        >
          <Pressable
            onPress={handleLogin}
            style={[styles.button, isLoading && styles.buttonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Signup")}
            style={styles.linkButton}
            disabled={isLoading}
          >
            <Text style={styles.linkButtonText}>
              Don't have an account? Sign Up
            </Text>
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: responsiveSize.base,
    paddingVertical: responsiveSize.lg,
  },
  logo: {
    width: imageDimensions.avatarLarge,
    height: imageDimensions.avatarLarge,
    resizeMode: "contain",
    marginBottom: 40,
  },
  title: {
    ...typography.h1,
    fontSize: fontSize.h2,
    color: colors.textPrimary,
    marginBottom: responsiveSize.md,
    textAlign: "center",
    fontWeight: "800",
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: responsiveSize.lg,
    fontSize: fontSize.body,
  },
  inputGroup: {
    width: "100%",
    maxWidth: isTablet() ? 500 : 350,
    marginBottom: responsiveSize.base,
  },
  input: {
    width: "100%",
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
    textAlign: "center",
    marginBottom: responsiveSize.md,
    fontSize: fontSize.small,
  },
  buttonGroup: {
    width: "100%",
    maxWidth: isTablet() ? 500 : 350,
    alignItems: "center",
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: buttonDimensions.paddingVertical,
    paddingHorizontal: buttonDimensions.paddingHorizontal,
    borderRadius: borderRadius.medium,
    width: "100%",
    alignItems: "center",
    marginBottom: responsiveSize.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.body,
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.body,
  },
  linkButton: {
    paddingVertical: responsiveSize.md,
  },
  linkButtonText: {
    ...typography.body,
    color: colors.secondary,
    fontWeight: "600",
    fontSize: fontSize.body,
  },
});
