/**
 * OTP 驗證頁 — 輸入 6 位驗證碼
 * API: trpc.auth.verifyOtp → 返回 token + user
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY } from '../../constants/data';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setAuth } = useAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // 倒計時
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation({
    onSuccess: async (data) => {
      try {
        await setAuth(data.token, {
          id: data.user.id,
          phone: data.user.phone,
          name: data.user.name,
          role: data.user.role,
          avatarUrl: (data.user as any).avatarUrl,
          iPointBalance: (data.user as any).iPointBalance,
        });
        router.replace('/(tabs)');
      } catch (err) {
        Alert.alert('錯誤', '登入失敗，請重試');
      } finally {
        setVerifying(false);
      }
    },
    onError: (err) => {
      Alert.alert('驗證失敗', err.message || '驗證碼錯誤或已過期');
      setVerifying(false);
      setOtp('');
    },
  });

  const sendOtpMutation = trpc.auth.sendOtp.useMutation({
    onSuccess: () => {
      setCountdown(60);
      setResending(false);
      Alert.alert('成功', '驗證碼已重新發送');
    },
    onError: (err) => {
      Alert.alert('發送失敗', err.message || '請稍後重試');
      setResending(false);
    },
  });

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(cleaned);
    if (cleaned.length === OTP_LENGTH) {
      setVerifying(true);
      verifyOtpMutation.mutate({ phone: phone || '', code: cleaned });
    }
  };

  const handleResend = () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    sendOtpMutation.mutate({ phone: phone || '' });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 返回按鈕 */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>{'‹'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>輸入驗證碼</Text>
        <Text style={styles.subtitle}>
          驗證碼已發送至{'\n'}
          <Text style={styles.phoneHighlight}>+853 {phone}</Text>
        </Text>

        {/* OTP 輸入框（隱藏真實 input，顯示自定義格子） */}
        <View style={styles.otpWrap}>
          <View style={styles.otpBoxes}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.otpBox, otp.length === i && styles.otpBoxActive, otp[i] && styles.otpBoxFilled]}
                onPress={() => inputRef.current?.focus()}
                activeOpacity={0.8}
              >
                <Text style={styles.otpChar}>{otp[i] || ''}</Text>
                {otp.length === i && <View style={styles.cursor} />}
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
          />
        </View>

        {/* 驗證中 */}
        {verifying && (
          <View style={styles.verifyingWrap}>
            <ActivityIndicator color={APP_ORANGE} size="small" />
            <Text style={styles.verifyingText}>驗證中...</Text>
          </View>
        )}

        {/* 重新發送 */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={countdown > 0 || resending}
          style={styles.resendBtn}
        >
          {resending ? (
            <ActivityIndicator color={APP_ORANGE} size="small" />
          ) : (
            <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
              {countdown > 0 ? `重新發送（${countdown}s）` : '重新發送驗證碼'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  backBtn: {
    marginTop: 56,
    marginLeft: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backText: { fontSize: 24, color: APP_TEXT, marginTop: -2 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '700', color: APP_TEXT, marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: APP_GRAY, lineHeight: 22, marginBottom: 40 },
  phoneHighlight: { color: APP_TEXT, fontWeight: '600' },
  otpWrap: { position: 'relative', marginBottom: 32 },
  otpBoxes: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxActive: { borderColor: APP_ORANGE },
  otpBoxFilled: { borderColor: APP_ORANGE, backgroundColor: '#fff9f5' },
  otpChar: { fontSize: 24, fontWeight: '700', color: APP_TEXT },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 2,
    height: 20,
    backgroundColor: APP_ORANGE,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  verifyingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 16 },
  verifyingText: { fontSize: 14, color: APP_GRAY },
  resendBtn: { alignItems: 'center', paddingVertical: 12 },
  resendText: { fontSize: 14, color: APP_ORANGE, fontWeight: '500' },
  resendTextDisabled: { color: APP_GRAY },
});
