import { useAuth } from "@/contexts/AuthContext";
import { sanitizeText } from "@/utils/sanitize";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebaseConfig"; 
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { login, register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // ── Firebase error mapper ─────────────────────────────────────────────────

  // Maps Firebase error codes to user-friendly messages.
  // Avoids exposing raw Firebase error strings to the user.
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          return "Incorrect email or password";
        case "auth/email-already-in-use":
          return "An account with this email already exists";
        case "auth/invalid-email":
          return "Please enter a valid email address";
        case "auth/weak-password":
          return "Password must be at least 6 characters";
        case "auth/too-many-requests":
          return "Too many attempts. Please try again later";
        case "auth/network-request-failed":
          return "Network error. Please check your connection";
        case "auth/user-disabled":
          return "This account has been disabled";
      }
    }
    return "Something went wrong. Please try again";
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your email and password");
      return;
    }
    // Basic email format check before hitting Firebase
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[Login] Attempting login for:", email.trim());
      await login(sanitizeText(email.trim()), password);
      console.log("[Login] Login successful");
    } catch (error) {
      console.warn("[Login] Login failed:", error);
      Alert.alert("Login Failed", getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter your name, email and password");
      return;
    }

    // Basic email format check before hitting Firebase
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      console.log("[Login] Attempting registration for:", email.trim());
      await register(sanitizeText(email.trim()), password, sanitizeText(displayName.trim()));
      console.log("[Login] Registration successful");
    } catch (error) {
      console.warn("[Login] Registration failed:", error);
      Alert.alert("Registration Failed", getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Password reset ────────────────────────────────────────────────────────

  // Sends a password reset email via Firebase.
  // Shows an alert asking for the email first if the field is empty.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        "Reset Password",
        "Please enter your email address above and then tap Forgot Password again."
      );
      return;
    }

    try {
      console.log("[Login] Sending password reset email to:", email.trim());
      await sendPasswordResetEmail(auth, sanitizeText(email.trim()));
      Alert.alert(
        "Email Sent",
        `A password reset link has been sent to ${email.trim()}.`
      );
      console.log("[Login] Password reset email sent successfully");
    } catch (error) {
      console.error("[Login] Password reset failed:", error);
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  // ── Toggle login / register ───────────────────────────────────────────────

  // Clears all fields when switching between login and register modes
  const toggleMode = () => {
    setIsRegistering((prev) => !prev);
    setEmail("");
    setPassword("");
    setDisplayName("");
    console.log("[Login] Switched to:", !isRegistering ? "register" : "login");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Brand section ─────────────────────────────────────────── */}
          {/* Large logo and app name — makes a strong first impression */}
          <View className="items-center mb-10">
            <Image
              source={require("../assets/images/reportXlogo.png")}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
            <Text className="text-4xl font-bold text-text mt-4 tracking-wide">
              FieldReportX
            </Text>
            <Text className="text-sm text-textSecondary mt-1">
              Field reporting made simple
            </Text>
          </View>

          {/* ── Screen title ──────────────────────────────────────────── */}
          <Text className="text-2xl font-bold text-text text-center mb-6">
            {isRegistering ? "Create Account" : "Welcome Back"}
          </Text>

          {/* ── Form ──────────────────────────────────────────────────── */}
          <View className="gap-4">

            {/* Display name — only shown during registration */}
            {isRegistering && (
              <TextInput
                className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
                placeholder="Display name"
                placeholderTextColor="#888"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="name"
              />
            )}

            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="Email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              className="border border-border rounded-xl px-4 py-4 text-base text-text bg-surface"
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              textContentType={isRegistering ? "newPassword" : "password"}
            />

            {/* Forgot password — only shown on login mode */}
            {!isRegistering && (
              <Pressable
                className="self-end active:opacity-50"
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                <Text className="text-sm text-primary font-semibold">
                  Forgot password?
                </Text>
              </Pressable>
            )}

            {/* Submit button */}
            <Pressable
              className={`rounded-xl py-4 items-center mt-2 ${
                isLoading ? "bg-primary opacity-60" : "bg-primary active:opacity-80"
              }`}
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={isLoading}
            >
              <Text className="text-white font-bold text-base">
                {isLoading
                  ? isRegistering ? "Creating account..." : "Signing in..."
                  : isRegistering ? "Create Account" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          {/* ── Toggle login / register ───────────────────────────────── */}
          <View className="flex-row justify-center mt-8 gap-1">
            <Text className="text-sm text-textSecondary">
              {isRegistering
                ? "Already have an account?"
                : "Don't have an account?"}
            </Text>
            <Pressable onPress={toggleMode} disabled={isLoading} className="active:opacity-50">
              <Text className="text-sm font-semibold text-primary">
                {isRegistering ? "Sign in" : "Create one"}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
