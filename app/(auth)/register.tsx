/**
 * 註冊頁 — 手機號 + 密碼 + OTP 驗證碼
 * API: trpc.phoneAuth.sendOtp + trpc.phoneAuth.register
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function RegisterScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [otp, setOtp] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtpMutation = trpc.phoneAuth.sendOtp.useMutation({
    onSuccess: () => {
      setCountdown(60);
      setSendingOtp(false);
      Alert.alert('成功', '驗證碼已發送，請查收短信');
    },
    onError: (err) => {
      Alert.alert('發送失敗', err.message || '請稍後重試');
      setSendingOtp(false);
    },
  });

  const registerMutation = trpc.phoneAuth.register.useMutation({
    onSuccess: async (data) => {
      try {
        const token = (data as any).token ?? '';
        await setAuth(token, {
          id: data.user.id,
          phone: data.user.phone ?? '',
          name: data.user.name ?? undefined,
          role: data.user.role,
        });
        Alert.alert('註冊成功', '歡迎加入 GoGoCar！', [
          { text: '確定', onPress: () => router.replace('/(tabs)') },
        ]);
      } catch {
        Alert.alert('錯誤', '註冊後自動登入失敗，請手動登入');
        router.replace('/(auth)/login');
      } finally {
        setRegistering(false);
      }
    },
    onError: (err) => {
      Alert.alert('註冊失敗', err.message || '請稍後重試');
      setRegistering(false);
    },
  });

  const handleSendOtp = () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!cleaned || cleaned.length < 8) {
      Alert.alert('提示', '請先輸入正確的手機號碼');
      return;
    }
    setSendingOtp(true);
    sendOtpMutation.mutate({ areaCode: '+853', phone: cleaned });
  };

  const handleRegister = () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!cleaned || cleaned.length < 8) { Alert.alert('提示', '請輸入正確的手機號碼'); return; }
    if (password.length < 6) { Alert.alert('提示', '密碼最少 6 位'); return; }
    if (password !== confirmPwd) { Alert.alert('提示', '兩次密碼不一致'); return; }
    if (otp.length !== 6) { Alert.alert('提示', '請輸入 6 位驗證碼'); return; }
    setRegistering(true);
    registerMutation.mutate({ areaCode: '+853', phone: cleaned, password, otp });
  };

  const canSend = phone.trim().length >= 8 && countdown === 0 && !sendingOtp;
  const canRegister = phone.trim().length >= 8 && password.length >= 6 && confirmPwd === password && otp.length === 6 && !registering;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* 返回 */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>建立帳號</Text>
        <Text style={styles.subtitle}>使用手機號碼註冊 GoGoCar</Text>

        <View style={styles.formWrap}>
          {/* 手機號 */}
          <Text style={styles.label}>手機號碼</Text>
          <View style={styles.phoneRow}>
            <View style={styles.areaCode}><Text style={styles.areaCodeText}>+853</Text></View>
            <TextInput
              style={styles.phoneInput} placeholder="請輸入 8 位手機號" placeholderTextColor={APP_GRAY}
              keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={12}
            />
          </View>

          {/* 密碼 */}
          <Text style={styles.label}>密碼</Text>
          <View style={styles.pwdRow}>
            <TextInput
              style={styles.pwdInput} placeholder="至少 6 位" placeholderTextColor={APP_GRAY}
              secureTextEntry={!showPwd} value={password} onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPwd ? '隱藏' : '顯示'}</Text>
            </TouchableOpacity>
          </View>

          {/* 確認密碼 */}
          <Text style={styles.label}>確認密碼</Text>
          <View style={[styles.pwdRow, { marginBottom: 16 }]}>
            <TextInput
              style={styles.pwdInput} placeholder="請再次輸入密碼" placeholderTextColor={APP_GRAY}
              secureTextEntry={!showPwd} value={confirmPwd} onChangeText={setConfirmPwd}
            />
          </View>

          {/* 驗證碼 */}
          <Text style={styles.label}>驗證碼</Text>
          <View style={styles.otpRow}>
            <TextInput
              style={styles.otpInput} placeholder="6 位驗證碼" placeholderTextColor={APP_GRAY}
              keyboardType="number-pad" value={otp} onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))} maxLength={6}
            />
            <TouchableOpacity
              style={[styles.sendOtpBtn, !canSend && styles.sendOtpBtnDisabled]}
              onPress={handleSendOtp} disabled={!canSend}
            >
              {sendingOtp ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendOtpText}>{countdown > 0 ? `${countdown}s` : '獲取驗證碼'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 註冊按鈕 */}
          <TouchableOpacity
            style={[styles.submitBtn, !canRegister && styles.submitBtnDisabled]}
            onPress={handleRegister} disabled={!canRegister} activeOpacity={0.8}
          >
            {registering ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>註冊</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>已有帳號？<Text style={{ color: APP_ORANGE }}>登入</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginTop: 56, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  backText: { fontSize: 24, color: APP_TEXT, marginTop: -2 },
  title: { fontSize: 28, fontWeight: '700', color: APP_TEXT, marginTop: 24, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: APP_GRAY, marginBottom: 28 },
  formWrap: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  label: { fontSize: 13, fontWeight: '600', color: APP_TEXT, marginBottom: 6 },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderColor: APP_BORDER, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  areaCode: { paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#f5f5f7', borderRightWidth: 1, borderRightColor: APP_BORDER },
  areaCodeText: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  phoneInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, color: APP_TEXT },
  pwdRow: { flexDirection: 'row', borderWidth: 1, borderColor: APP_BORDER, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  pwdInput: { flex: 1, height: 48, paddingHorizontal: 14, fontSize: 15, color: APP_TEXT },
  eyeBtn: { paddingHorizontal: 14, justifyContent: 'center' },
  eyeText: { fontSize: 13, color: APP_GRAY },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  otpInput: { flex: 1, height: 48, borderWidth: 1, borderColor: APP_BORDER, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: APP_TEXT },
  sendOtpBtn: { height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  sendOtpBtnDisabled: { backgroundColor: '#ffb380' },
  sendOtpText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  submitBtn: { height: 50, borderRadius: 12, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#ffb380' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: 14, color: APP_GRAY },
});
