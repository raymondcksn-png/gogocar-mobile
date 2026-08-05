/**
 * 修改手機號碼頁 — 對齊 WebApp AppChangePhone
 * 流程：輸入新號碼 → 發送 OTP → 輸入驗證碼 → 確認修改
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const AREA_CODES = [
  { code: '+853', label: '🇲🇴 +853 澳門' },
  { code: '+852', label: '🇭🇰 +852 香港' },
  { code: '+86', label: '🇨🇳 +86 中國' },
];

export default function ChangePhoneScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  const [areaCode, setAreaCode] = useState('+853');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showAreaPicker, setShowAreaPicker] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtpMut = trpc.phoneAuth.sendOtp.useMutation({
    onSuccess: () => { setOtpSent(true); setCountdown(60); },
    onError: (e: any) => Alert.alert('發送失敗', e.message),
  });

  const changePhoneMut = trpc.auth.changePhone.useMutation({
    onSuccess: () => { Alert.alert('修改成功', '手機號碼已更新'); router.back(); },
    onError: (e: any) => Alert.alert('修改失敗', e.message),
  });

  const handleSendOtp = () => {
    if (!phone.trim()) { Alert.alert('請輸入新手機號碼'); return; }
    sendOtpMut.mutate({ areaCode: areaCode as any, phone: phone.trim() });
  };

  const handleConfirm = () => {
    if (otp.length !== 6) { Alert.alert('請輸入 6 位驗證碼'); return; }
    changePhoneMut.mutate({ phone: areaCode + phone.trim(), otp });
  };

  const maskedPhone = (user as any)?.phone
    ? (user as any).phone.replace(/(\+\d{3})(\d+)(\d{4})/, '$1****$3')
    : '未設置';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>修改手機號碼</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 當前號碼 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>當前手機號碼</Text>
          <View style={styles.currentPhone}>
            <Text style={styles.currentPhoneText}>{maskedPhone}</Text>
          </View>
        </View>

        {/* 新號碼 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>新手機號碼</Text>
          <View style={styles.phoneRow}>
            <TouchableOpacity
              style={styles.areaCodeBtn}
              onPress={() => setShowAreaPicker(!showAreaPicker)}
              activeOpacity={0.7}
            >
              <Text style={styles.areaCodeText}>{areaCode}</Text>
              <Ionicons name="chevron-down" size={14} color={APP_GRAY} />
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
              placeholder="輸入號碼"
              placeholderTextColor={APP_GRAY}
              keyboardType="phone-pad"
              maxLength={12}
            />
          </View>
          {showAreaPicker && (
            <View style={styles.areaPicker}>
              {AREA_CODES.map((ac) => (
                <TouchableOpacity
                  key={ac.code}
                  style={[styles.areaOption, areaCode === ac.code && styles.areaOptionActive]}
                  onPress={() => { setAreaCode(ac.code); setShowAreaPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.areaOptionText, areaCode === ac.code && { color: APP_ORANGE, fontWeight: '600' }]}>
                    {ac.label}
                  </Text>
                  {areaCode === ac.code && <Ionicons name="checkmark" size={16} color={APP_ORANGE} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 驗證碼 */}
        {otpSent && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>驗證碼</Text>
            <View style={styles.otpRow}>
              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="輸入 6 位驗證碼"
                placeholderTextColor={APP_GRAY}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.resendBtn, countdown > 0 && styles.resendBtnDisabled]}
                onPress={handleSendOtp}
                disabled={countdown > 0 || sendOtpMut.isPending}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendBtnText, countdown > 0 && { color: APP_GRAY }]}>
                  {countdown > 0 ? `${countdown}s` : '重新發送'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 按鈕 */}
        <View style={styles.btnSection}>
          {!otpSent ? (
            <TouchableOpacity
              style={[styles.btn, (!phone.trim() || sendOtpMut.isPending) && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={!phone.trim() || sendOtpMut.isPending}
              activeOpacity={0.8}
            >
              {sendOtpMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>發送驗證碼</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, (otp.length !== 6 || changePhoneMut.isPending) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={otp.length !== 6 || changePhoneMut.isPending}
              activeOpacity={0.8}
            >
              {changePhoneMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>確認修改</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  section: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, color: APP_GRAY, paddingTop: 12, paddingBottom: 8, fontWeight: '500' },
  currentPhone: { paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: APP_BORDER },
  currentPhoneText: { fontSize: 16, color: APP_TEXT, fontWeight: '500' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: APP_BORDER },
  areaCodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' },
  areaCodeText: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  phoneInput: { flex: 1, fontSize: 15, color: APP_TEXT, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f3f4f6' },
  areaPicker: { borderTopWidth: 0.5, borderTopColor: APP_BORDER, paddingBottom: 8 },
  areaOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  areaOptionActive: {},
  areaOptionText: { fontSize: 15, color: APP_TEXT },
  otpRow: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: APP_BORDER },
  otpInput: { flex: 1, fontSize: 20, letterSpacing: 4, color: APP_TEXT, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f3f4f6', textAlign: 'center' },
  resendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: `${APP_ORANGE}15` },
  resendBtnDisabled: { backgroundColor: '#f3f4f6' },
  resendBtnText: { fontSize: 13, fontWeight: '600', color: APP_ORANGE },
  btnSection: { padding: 20 },
  btn: { backgroundColor: APP_ORANGE, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#f3f4f6' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
