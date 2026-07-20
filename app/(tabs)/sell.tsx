/**
 * 賣車/發佈頁 — 發佈車源表單
 * API: trpc.vehicle.createPost + trpc.vehicle.getDsatBrands
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const VEHICLE_TYPES = [
  { label: '私家車', value: 'car' },
  { label: '電單車', value: 'motorcycle' },
  { label: '商用車', value: 'commercial' },
];

const TRANSMISSION_TYPES = [
  { label: '自動波', value: 'auto' },
  { label: '手波', value: 'manual' },
  { label: 'CVT', value: 'cvt' },
];

const FUEL_TYPES = [
  { label: '汽油', value: 'petrol' },
  { label: '柴油', value: 'diesel' },
  { label: '純電', value: 'electric' },
  { label: '油電混合', value: 'hybrid' },
  { label: '插電混動', value: 'pluginHybrid' },
];

interface FormData {
  vehicleType: string;
  brandName: string;
  modelName: string;
  year: string;
  mileage: string;
  price: string;
  transmission: string;
  fuelType: string;
  colorName: string;
  description: string;
  contactPhone: string;
}

export default function SellScreen() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [form, setForm] = useState<FormData>({
    vehicleType: 'car',
    brandName: '',
    modelName: '',
    year: '',
    mileage: '',
    price: '',
    transmission: 'auto',
    fuelType: 'petrol',
    colorName: '',
    description: '',
    contactPhone: user?.phone || '',
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const createPostMutation = trpc.vehicle.createPost.useMutation({
    onSuccess: (data) => {
      setSubmitting(false);
      Alert.alert('成功', '車源已提交，等待審核後將顯示在列表中', [
        { text: '確定', onPress: () => router.push('/(tabs)/buy') },
      ]);
    },
    onError: (err) => {
      setSubmitting(false);
      Alert.alert('提交失敗', err.message || '請稍後重試');
    },
  });

  const handlePickPhoto = async () => {
    if (photos.length >= 10) {
      Alert.alert('提示', '最多上傳 10 張圖片');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map(a => a.uri);
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 10));
    }
  };

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '請先登入才能發佈車源', [
        { text: '去登入', onPress: () => router.push('/(auth)/login') },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }
    if (!form.brandName.trim()) { Alert.alert('提示', '請填寫品牌'); return; }
    if (!form.modelName.trim()) { Alert.alert('提示', '請填寫型號'); return; }
    if (!form.price.trim()) { Alert.alert('提示', '請填寫售價'); return; }
    if (!form.contactPhone.trim()) { Alert.alert('提示', '請填寫聯絡電話'); return; }

    setSubmitting(true);
    createPostMutation.mutate({
      vehicleType: form.vehicleType,
      brandName: form.brandName,
      modelName: form.modelName,
      year: form.year ? parseInt(form.year) : undefined,
      mileage: form.mileage ? parseInt(form.mileage) : undefined,
      price: parseInt(form.price),
      transmission: form.transmission,
      fuelType: form.fuelType,
      colorName: form.colorName,
      description: form.description,
      contactPhone: form.contactPhone,
    });
  };

  const update = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  if (!isLoggedIn) {
    return (
      <View style={styles.guestWrap}>
        <Text style={styles.guestIcon}>🚗</Text>
        <Text style={styles.guestTitle}>登入後即可發佈車源</Text>
        <Text style={styles.guestSubtitle}>免費發佈，快速出售您的愛車</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginBtnText}>立即登入</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>發佈車源</Text>
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 車輛類型 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>車輛類型 *</Text>
          <View style={styles.optionRow}>
            {VEHICLE_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.optionBtn, form.vehicleType === t.value && styles.optionBtnActive]}
                onPress={() => update('vehicleType', t.value)}
              >
                <Text style={[styles.optionBtnText, form.vehicleType === t.value && styles.optionBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <FormField label="品牌 *" placeholder="例：Toyota" value={form.brandName} onChangeText={v => update('brandName', v)} />
          <FormField label="型號 *" placeholder="例：Camry" value={form.modelName} onChangeText={v => update('modelName', v)} />
          <FormField label="年份" placeholder="例：2020" value={form.year} onChangeText={v => update('year', v)} keyboardType="numeric" />
          <FormField label="里數 (km)" placeholder="例：50000" value={form.mileage} onChangeText={v => update('mileage', v)} keyboardType="numeric" />
          <FormField label="售價 (HKD) *" placeholder="例：150000" value={form.price} onChangeText={v => update('price', v)} keyboardType="numeric" />
          <FormField label="車身顏色" placeholder="例：珍珠白" value={form.colorName} onChangeText={v => update('colorName', v)} />
        </View>

        {/* 變速箱 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>變速箱</Text>
          <View style={styles.optionRow}>
            {TRANSMISSION_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.optionBtn, form.transmission === t.value && styles.optionBtnActive]}
                onPress={() => update('transmission', t.value)}
              >
                <Text style={[styles.optionBtnText, form.transmission === t.value && styles.optionBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 燃油類型 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>燃油類型</Text>
          <View style={styles.optionRow}>
            {FUEL_TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.optionBtn, form.fuelType === t.value && styles.optionBtnActive]}
                onPress={() => update('fuelType', t.value)}
              >
                <Text style={[styles.optionBtnText, form.fuelType === t.value && styles.optionBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 圖片上傳 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>車輛圖片（最多10張）</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                >
                  <Text style={styles.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 10 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto}>
                <Text style={styles.addPhotoIcon}>+</Text>
                <Text style={styles.addPhotoText}>添加圖片</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* 描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>車輛描述</Text>
          <TextInput
            style={styles.textarea}
            placeholder="描述車輛狀況、配置、歷史等..."
            placeholderTextColor={APP_GRAY}
            value={form.description}
            onChangeText={v => update('description', v)}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* 聯絡電話 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>聯絡電話 *</Text>
          <TextInput
            style={styles.input}
            placeholder="聯絡電話"
            placeholderTextColor={APP_GRAY}
            value={form.contactPhone}
            onChangeText={v => update('contactPhone', v)}
            keyboardType="phone-pad"
          />
        </View>

        {/* 提交按鈕 */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>提交發佈</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({
  label, placeholder, value, onChangeText, keyboardType
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; keyboardType?: any;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={APP_GRAY}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: APP_BORDER,
    backgroundColor: '#fff',
  },
  optionBtnActive: { backgroundColor: APP_ORANGE, borderColor: APP_ORANGE },
  optionBtnText: { fontSize: 13, color: APP_GRAY },
  optionBtnTextActive: { color: '#fff', fontWeight: '600' },
  formField: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: APP_GRAY, marginBottom: 6 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: APP_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: APP_TEXT,
    backgroundColor: '#fff',
  },
  textarea: {
    borderWidth: 1,
    borderColor: APP_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: APP_TEXT,
    minHeight: 100,
  },
  photoRow: { flexDirection: 'row' },
  photoWrap: { position: 'relative', marginRight: 8 },
  photo: { width: 80, height: 80, borderRadius: 8 },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: APP_BORDER,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_BG,
  },
  addPhotoIcon: { fontSize: 24, color: APP_GRAY },
  addPhotoText: { fontSize: 11, color: APP_GRAY, marginTop: 2 },
  submitBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#ffb380' },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  guestWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: APP_BG, padding: 32 },
  guestIcon: { fontSize: 64, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  guestSubtitle: { fontSize: 14, color: APP_GRAY, marginBottom: 32, textAlign: 'center' },
  loginBtn: {
    width: 200,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
