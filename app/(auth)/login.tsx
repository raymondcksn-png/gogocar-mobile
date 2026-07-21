/**
 * 登入頁 — 手機號 + 密碼
 * API: trpc.phoneAuth.login
 * 入口：「忘記密碼」→ /(auth)/forgot-password
 *       「立即註冊」→ /(auth)/register
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.phoneAuth.login.useMutation({
    onSuccess: async (data) => {
      try {
        // phoneAuth.login 回傳 token via cookie；同時取 token 欄位（若有）
        // 因後端用 setSessionCookie，token 也在回傳 body
        const token = (data as any).token ?? '';
        await setAuth(token, {
          id: data.user.id,
          phone: data.user.phone ?? '',
          name: data.user.name ?? undefined,
          role: data.user.role,
        });
        router.replace('/(tabs)');
      } catch {
        Alert.alert('錯誤', '登入失敗，請重試');
      } finally {
        setLoading(false);
      }
    },
    onError: (err) => {
      Alert.alert('登入失敗', err.message || '帳號或密碼錯誤');
      setLoading(false);
    },
  });

  const handleLogin = () => {
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!cleaned || cleaned.length < 8) {
      Alert.alert('提示', '請輸入正確的手機號碼');
      return;
    }
    if (!password.trim()) {
      Alert.alert('提示', '請輸入密碼');
      return;
    }
    setLoading(true);
    loginMutation.mutate({ areaCode: '+853', phone: cleaned, password: password.trim() });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          <Text style={styles.formTitle}>登入帳號</Text>

          {/* 手機號 */}
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
              returnKeyType="next"
            />
          </View>

          {/* 密碼 */}
          <View style={styles.pwdRow}>
            <TextInput
              style={styles.pwdInput}
              placeholder="密碼"
              placeholderTextColor={APP_GRAY}
              secureTextEntry={!showPwd}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPwd ? '隱藏' : '顯示'}</Text>
            </TouchableOpacity>
          </View>

          {/* 忘記密碼 */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotBtn}
          >
            <Text style={styles.forgotText}>忘記密碼？</Text>
          </TouchableOpacity>

          {/* 登入按鈕 */}
          <TouchableOpacity
            style={[styles.loginBtn, (!phone.trim() || !password.trim() || loading) && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!phone.trim() || !password.trim() || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>登入</Text>
            )}
          </TouchableOpacity>

          {/* 分隔線 */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>還沒有帳號？</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 去註冊 */}
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerBtnText}>立即免費註冊</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          登入即代表您同意 GoGoCar 的服務條款及私隱政策
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginTop: 60, marginBottom: 36 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  appName: { fontSize: 24, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  appSlogan: { fontSize: 13, color: APP_GRAY, marginTop: 4 },
  formWrap: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 20 },
  phoneRow: {
    flexDirection: 'row', borderWidth: 1, borderColor: APP_BORDER,
    borderRadius: 12, overflow: 'hidden', marginBottom: 12,
  },
  areaCode: {
    paddingHorizontal: 14, justifyContent: 'center',
    backgroundColor: '#f5f5f7', borderRightWidth: 1, borderRightColor: APP_BORDER,
  },
  areaCodeText: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  phoneInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 16, color: APP_TEXT },
  pwdRow: {
    flexDirection: 'row', borderWidth: 1, borderColor: APP_BORDER,
    borderRadius: 12, overflow: 'hidden', marginBottom: 8,
  },
  pwdInput: { flex: 1, height: 50, paddingHorizontal: 14, fontSize: 16, color: APP_TEXT },
  eyeBtn: { paddingHorizontal: 14, justifyContent: 'center' },
  eyeText: { fontSize: 13, color: APP_GRAY },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  forgotText: { fontSize: 13, color: APP_ORANGE },
  loginBtn: {
    height: 50, borderRadius: 12, backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  loginBtnDisabled: { backgroundColor: '#ffb380' },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: APP_BORDER },
  dividerText: { fontSize: 13, color: APP_GRAY, marginHorizontal: 10 },
  registerBtn: {
    height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  registerBtnText: { fontSize: 16, fontWeight: '600', color: APP_ORANGE },
  disclaimer: { fontSize: 11, color: APP_GRAY, textAlign: 'center', marginTop: 24, lineHeight: 16 },
});
