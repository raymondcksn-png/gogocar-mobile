/**
 * 登入頁 — 手機號碼輸入 + 發送 OTP
 * API: trpc.auth.sendOtp
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY } from '../../constants/data';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const sendOtpMutation = trpc.auth.sendOtp.useMutation({
    onSuccess: () => {
      router.push({ pathname: '/(auth)/otp', params: { phone } });
    },
    onError: (err) => {
      Alert.alert('發送失敗', err.message || '請稍後重試');
      setSending(false);
    },
  });

  const handleSend = () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!cleaned || cleaned.length < 8) {
      Alert.alert('提示', '請輸入正確的手機號碼');
      return;
    }
    setSending(true);
    sendOtpMutation.mutate({ phone: cleaned });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 返回按鈕 */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>

        {/* Logo 區 */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>GG</Text>
          </View>
          <Text style={styles.appName}>GoGoCar</Text>
          <Text style={styles.appSlogan}>澳門二手車交易平台</Text>
        </View>

        {/* 表單 */}
        <View style={styles.formWrap}>
          <Text style={styles.formTitle}>手機號碼登入</Text>
          <Text style={styles.formSubtitle}>輸入您的澳門手機號碼，我們將發送驗證碼</Text>

          <View style={styles.phoneRow}>
            <View style={styles.areaCode}>
              <Text style={styles.areaCodeText}>+853</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="手機號碼"
              placeholderTextColor={APP_GRAY}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={handleSend}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, (!phone.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!phone.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>發送驗證碼</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            登入即代表您同意 GoGoCar 的服務條款及私隱政策
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: {
    marginTop: 56,
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
  logoWrap: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  appName: { fontSize: 24, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  appSlogan: { fontSize: 13, color: APP_GRAY, marginTop: 4 },
  formWrap: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 6 },
  formSubtitle: { fontSize: 13, color: APP_GRAY, marginBottom: 24, lineHeight: 18 },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  areaCode: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    borderRightWidth: 1,
    borderRightColor: '#e5e5ea',
  },
  areaCodeText: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  phoneInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    color: APP_TEXT,
  },
  sendBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sendBtnDisabled: { backgroundColor: '#ffb380' },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disclaimer: { fontSize: 11, color: APP_GRAY, textAlign: 'center', lineHeight: 16 },
});
