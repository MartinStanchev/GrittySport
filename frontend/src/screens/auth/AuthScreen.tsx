import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError } from '../../services/api';
import { authStyles as styles } from './authStyles';

const RESEND_COOLDOWN_SECONDS = 30;

type Step = 'email' | 'code';

export default function AuthScreen() {
  const { colors } = useTheme();
  const { requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<TextInput>(null);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send(emailToSend: string) {
    setError('');
    setLoading(true);
    try {
      await requestOtp(emailToSend);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailContinue() {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    try {
      await send(email.trim().toLowerCase());
      setStep('code');
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch (e) {
      setError(extractMessage(e));
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(email.trim().toLowerCase(), code);
    } catch (e) {
      setError(extractMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setCode('');
    try {
      await send(email.trim().toLowerCase());
    } catch (e) {
      setError(extractMessage(e));
    }
  }

  function handleChangeEmail() {
    setStep('email');
    setCode('');
    setError('');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.primary }]}>GRITTY FITNESS</Text>

        {step === 'email' ? (
          <View style={styles.form}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your email — we&apos;ll send you a sign-in code.
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border },
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="go"
              onSubmitEditing={handleEmailContinue}
            />
            {error ? <Text style={[styles.error, { color: colors.primary }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleEmailContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.buttonText, { color: '#FFF' }]}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We sent a code to{' '}
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{email}</Text>
            </Text>
            <TextInput
              ref={codeInputRef}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  textAlign: 'center',
                  letterSpacing: 8,
                  fontSize: 22,
                },
              ]}
              placeholder="000000"
              placeholderTextColor={colors.textSecondary}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={handleVerify}
            />
            {error ? <Text style={[styles.error, { color: colors.primary }]}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[styles.buttonText, { color: '#FFF' }]}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={handleResend} disabled={resendIn > 0}>
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                {resendIn > 0 ? (
                  `Resend code in ${resendIn}s`
                ) : (
                  <Text style={[styles.linkBold, { color: colors.primary }]}>Resend code</Text>
                )}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={handleChangeEmail}>
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>Change email</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function extractMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return `Network error: ${e.message}`;
  return 'Something went wrong. Please try again.';
}
