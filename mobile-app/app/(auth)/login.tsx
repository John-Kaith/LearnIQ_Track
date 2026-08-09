import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const SIGNUP_URL = 'https://learniqtrack.online/signup';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleLogin() {
    if (!identifier.trim() || !password) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const user = await login(identifier.trim(), password);
      if (user.role === 'teacher') {
        router.replace('/(teacher-tabs)/home');
      } else if (user.role === 'student') {
        router.replace('/(student-tabs)/home');
      } else {
        setFormError(
          `This app doesn't support "${user.role}" accounts yet. Use the web platform instead.`,
        );
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openWebSignup() {
    Linking.openURL(SIGNUP_URL);
  }

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>LQ</Text>
          </View>
          <Text style={styles.brandName}>LearnIQ Track</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome to LearnIQ</Text>
          <Text style={styles.subtitle}>Continue your learning journey</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Student ID or Email</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Enter ID or email"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <Pressable
            onPress={handleLogin}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && styles.loginBtnPressed,
              !canSubmit && styles.loginBtnDisabled,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={openWebSignup} style={styles.webLink} hitSlop={8}>
          <Text style={styles.webLinkText}>No account? Register on the web platform</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    marginBottom: 12,
  },
  markText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  brandName: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    marginTop: 6,
    marginBottom: 22,
    lineHeight: 22,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 15,
  },
  loginBtn: {
    marginTop: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  loginBtnPressed: {
    opacity: 0.9,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 14,
  },
  webLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  webLinkText: {
    color: Colors.primary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
