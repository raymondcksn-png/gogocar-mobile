/**
 * 賣車/發佈頁 — 三 Tab 發佈表單（v4.0：智能識別 / 搜索選擇 / 手動填寫）
 * 對照 WebApp AppPost.tsx，超越 WebApp 的原生體驗
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  FlatList, Modal, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const FUEL_TYPES = [
  { label: '汽油', value: 'petrol' },
  { label: '柴油', value: 'diesel' },
  { label: '純電', value: 'electric' },
  { label: '油電混合', value: 'hybrid' },
  { label: '插電混動', value: 'pluginHybrid' },
];
const REGISTRATION_REGIONS = [
  { label: '🇲🇴 澳門', value: 'macau' },
  { label: '🇭🇰 香港', value: 'hongkong' },
  { label: '🇨🇳 廣東', value: 'guangdong' },
];
const INCLUDED_PLATES_OPTIONS = [
  { label: '連港澳牌', value: 'hk_macao', desc: '澳門 ↔ 香港' },
  { label: '連粵港牌', value: 'gd_hk', desc: '廣東 ↔ 香港' },
  { label: '連粵澳牌', value: 'gd_macao', desc: '廣東 ↔ 澳門' },
  { label: '連三地牌', value: 'triple', desc: '粵港澳三地' },
];
type PostTab = 'ai' | 'search' | 'manual';
type VehicleType = 'car' | 'motorcycle';

interface FormData {
  vehicleType: VehicleType;
  brandId: number | null;
  brandName: string;
  seriesId: number | null;
  seriesName: string;
  modelId: number | null;
  modelName: string;
  subtitle: string;
  year: string;
  mileage: string;
  engineCapacity: string;
  transmission: 'auto' | 'manual';
  color: string;
  seats: string;
  fuelType: string;
  price: string;
  originalPrice: string;
  contactPhone: string;
  address: string;
  description: string;
  tags: string[];
  registrationRegion: 'macau' | 'hongkong' | 'guangdong';
  includedPlates: string[];
  rightHandDrive: boolean;
  photoUrls: { url: string }[];
}

const EMPTY_FORM: FormData = {
  vehicleType: 'car', brandId: null, brandName: '', seriesId: null, seriesName: '',
  modelId: null, modelName: '', subtitle: '', year: '', mileage: '', engineCapacity: '',
  transmission: 'auto', color: '', seats: '', fuelType: '', price: '', originalPrice: '',
  contactPhone: '', address: '', description: '', tags: [],
  registrationRegion: 'macau', includedPlates: [], rightHandDrive: false, photoUrls: [],
};

export default function SellScreen() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [activeTab, setActiveTab] = useState<PostTab>('ai');
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, contactPhone: (user as any)?.phone || '' });
  const [submitting, setSubmitting] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  const aiParseMutation = trpc.vehicle.aiParse.useMutation();
  const createPostMutation = trpc.vehicle.createPost.useMutation({
    onSuccess: (data: any) => {
      setSubmitting(false);
      router.push(`/post/success/${data.id}` as any);
    },
    onError: (err: any) => {
      setSubmitting(false);
      Alert.alert('提交失敗', err.message || '請稍後重試');
    },
  });
  const uploadMutation = trpc.vehicle.uploadFile.useMutation();

  const { data: brands } = trpc.vehicle.getBrands.useQuery({ vehicleType: form.vehicleType });
  const { data: seriesList } = trpc.vehicle.getSeriesByBrand.useQuery({ brandId: form.brandId! }, { enabled: !!form.brandId });
  const { data: modelsList } = trpc.vehicle.getModelsBySeries.useQuery({ seriesId: form.seriesId! }, { enabled: !!form.seriesId });
  const { data: modelDetail } = trpc.vehicle.getModelDetail.useQuery({ modelId: form.modelId! }, { enabled: !!form.modelId });
  const { data: searchResults } = trpc.vehicle.searchModels.useQuery(
    { query: searchDebounced, vehicleType: form.vehicleType, limit: 20 },
    { enabled: searchDebounced.length >= 1 }
  );
  const { data: dbTags } = trpc.vehicle.getActiveTags.useQuery();
  const { data: dbColors } = trpc.vehicle.getActiveColors.useQuery();

  const vehicleTags = useMemo(() => {
    if (!dbTags) return [];
    return (dbTags as any[]).filter((t: any) => t.category === 'vehicle');
  }, [dbTags]);

  const filteredBrands = useMemo(() => {
    if (!brands) return [];
    if (!brandSearch) return brands as any[];
    const q = brandSearch.toLowerCase();
    return (brands as any[]).filter((b: any) =>
      b.name?.toLowerCase().includes(q) || b.brandNameZh?.toLowerCase().includes(q)
    );
  }, [brands, brandSearch]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (modelDetail && form.modelId) {
      const d = modelDetail as any;
      const updates: Partial<FormData> = {};
      const newFilled = new Set<string>();
      if (d.dsatModelYear) { updates.year = String(d.dsatModelYear); newFilled.add('year'); }
      if (d.transmission) {
        const t = d.transmission.toLowerCase();
        updates.transmission = t.includes('auto') || t.includes('自動') ? 'auto' : 'manual';
        newFilled.add('transmission');
      }
      if (d.dsatEngineCapacity) { updates.engineCapacity = String(d.dsatEngineCapacity); newFilled.add('engineCapacity'); }
      if (d.dsatSeats) { updates.seats = String(d.dsatSeats); newFilled.add('seats'); }
      if (d.fuelType) { updates.fuelType = d.fuelType; newFilled.add('fuelType'); }
      if (d.dsfTaxPrice) { updates.originalPrice = String(d.dsfTaxPrice); newFilled.add('originalPrice'); }
      setForm(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(newFilled);
    }
  }, [modelDetail, form.modelId]);

  const handlePickPhoto = async () => {
    if (form.photoUrls.length >= 10) { Alert.alert('提示', '最多上傳 10 張圖片'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      for (const asset of result.assets) {
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const uploaded = await uploadMutation.mutateAsync({
            fileName: `photo_${Date.now()}.jpg`, fileData: base64,
            contentType: 'image/jpeg', category: 'photo',
          });
          setForm(prev => ({ ...prev, photoUrls: [...prev.photoUrls, { url: (uploaded as any).url }] }));
        } catch {
          Alert.alert('上傳失敗', '圖片上傳失敗，請重試');
        }
      }
    }
  };

  const handleAiParse = async () => {
    if (!aiText.trim()) { Alert.alert('提示', '請先貼上車源描述文字'); return; }
    setIsParsing(true);
    try {
      const result = await aiParseMutation.mutateAsync({ text: aiText, vehicleType: form.vehicleType }) as any;
      if (result?.success && result?.parsed) {
        const p = result.parsed;
        const matchedBrand = result.matchedBrand as { id: number; name: string } | null;
        const bestMatch = result.bestMatch as any | null;
        const updates: Partial<FormData> = {};
        const newFilled = new Set<string>();

        // 從 matchedBrand 回填品牌（後端已做數據庫匹配，有 ID）
        if (matchedBrand?.id) {
          updates.brandId = matchedBrand.id;
          updates.brandName = matchedBrand.name;
          newFilled.add('brandId'); newFilled.add('brandName');
        } else if (p.brand) {
          // fallback：AI 識別到品牌名但未匹配到數據庫，仍顯示文字
          updates.brandName = p.brand;
          newFilled.add('brandName');
        }

        // 從 bestMatch 回填車系和款式（後端已做最佳匹配）
        if (bestMatch?.seriesId) {
          updates.seriesId = bestMatch.seriesId;
          updates.seriesName = bestMatch.seriesName || '';
          newFilled.add('seriesId'); newFilled.add('seriesName');
        }
        if (bestMatch?.id) {
          updates.modelId = bestMatch.id;
          updates.modelName = bestMatch.modelName || '';
          newFilled.add('modelId'); newFilled.add('modelName');
        }

        // 從 parsed 回填所有字段（後端升級版 prompt 已包含電話/副標題/地址/引擎標籤等）
        const map: [string, keyof FormData, (v: any) => any][] = [
          ['year', 'year', v => String(v)],
          ['mileageKm', 'mileage', v => String(Math.round(v))],
          ['priceMOP', 'price', v => String(v)],
          ['color', 'color', v => v],
          ['seats', 'seats', v => String(v)],
          ['engineCapacity', 'engineCapacity', v => String(v)],
          ['fuelType', 'fuelType', v => {
            // 後端 fuelType fallback 可能返回中文，需轉為 APP 端按鈕 value
            const fuelMap: Record<string, string> = {
              '汽油': 'petrol', 'petrol': 'petrol', 'gasoline': 'petrol',
              '柴油': 'diesel', 'diesel': 'diesel',
              '純電': 'electric', 'electric': 'electric', 'ev': 'electric', 'bev': 'electric',
              '油電混合': 'hybrid', 'hybrid': 'hybrid', 'hev': 'hybrid',
              '插電混合': 'pluginHybrid', 'pluginhybrid': 'pluginHybrid', 'phev': 'pluginHybrid',
            };
            return fuelMap[v] || fuelMap[(v || '').toLowerCase()] || v;
          }],
          ['description', 'description', v => v],
          ['vehicleType', 'vehicleType', v => v],
          ['address', 'address', v => v],
          ['subtitle', 'subtitle', v => v],  // 副標題（如 1.5T渦輪）
        ];
        for (const [src, dest, transform] of map) {
          if (p[src] != null) { (updates as any)[dest] = transform(p[src]); newFilled.add(dest); }
        }
        // 電話：優先用後端提取的 contactPhone，fallback 前端正則
        if (p.contactPhone) {
          updates.contactPhone = p.contactPhone;
          newFilled.add('contactPhone');
        } else {
          const phoneMatch = aiText.match(/(?:SMS|TEL|電話|聯繫|聯絡|WhatsApp)?\s*(?:\+?853|\+?852|\+?86)?[-\s]?(\d[\d\s-]{6,14}\d)/i);
          if (phoneMatch) {
            const cleanPhone = phoneMatch[0].replace(/[^\d+]/g, '');
            updates.contactPhone = cleanPhone;
            newFilled.add('contactPhone');
          }
        }
        // 傳動：後端已規範化為 auto/manual
        if (p.transmission) {
          const t = p.transmission.toLowerCase();
          updates.transmission = (t === 'auto' || t.includes('auto') || t.includes('自動')) ? 'auto' : 'manual';
          newFilled.add('transmission');
        }
        setForm(prev => ({ ...prev, ...updates }));
        setAutoFilledFields(newFilled);
        // 顯示識別結果（含拼寫修正提示）
        const correctionNote = p.correctedInput ? `\n（已修正：${p.correctedInput}）` : '';
        const confidenceNote = (p.confidence != null && p.confidence < 70) ? `\n（識別置信度 ${p.confidence}%，請仔細核對）` : '';
        Alert.alert('識別完成', `已自動填充 ${newFilled.size} 個字段，請核對後提交${correctionNote}${confidenceNote}`);
        setActiveTab('manual');
      } else {
        Alert.alert('識別失敗', result?.error || '無法解析，請手動填寫');
      }
    } catch (err: any) {
      Alert.alert('識別失敗', err.message || '請稍後重試');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    setForm(prev => ({
      ...prev,
      brandId: item.brandId || null, brandName: item.brandName || item.brandNameZh || '',
      seriesId: item.seriesId || null, seriesName: item.seriesName || '',
      modelId: item.id || null, modelName: item.modelName || item.name || '',
    }));
    setSearchQuery(''); setSearchDebounced(''); setActiveTab('manual');
  };

  const handleSubmit = () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '請先登入才能發佈車源', [
        { text: '去登入', onPress: () => router.push('/(auth)/login' as any) },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }
    if (!form.brandName.trim()) { Alert.alert('提示', '請選擇或填寫品牌'); return; }
    if (!form.price.trim()) { Alert.alert('提示', '請填寫預期售價'); return; }
    if (!form.mileage.trim()) { Alert.alert('提示', '請填寫行駛里程'); return; }
    setSubmitting(true);
    const title = `${form.brandName} ${form.modelName} ${form.year ? form.year + '年' : ''}`.trim();
    createPostMutation.mutate({
      title, subtitle: form.subtitle || undefined, vehicleType: form.vehicleType,
      brandId: form.brandId || undefined, seriesId: form.seriesId || undefined, modelId: form.modelId || undefined,
      brandName: form.brandName || undefined, seriesName: form.seriesName || undefined, modelName: form.modelName || undefined,
      year: form.year ? Number(form.year) : undefined, mileage: form.mileage ? Math.round(Number(form.mileage)) : undefined,
      engineCapacity: form.engineCapacity ? Number(form.engineCapacity) : undefined,
      transmission: form.transmission, color: form.color || undefined,
      seats: form.seats ? Number(form.seats) : undefined, fuelType: form.fuelType || undefined,
      price: form.price ? Number(form.price) : undefined, originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
      contactPhone: form.contactPhone || undefined, address: form.address || undefined,
      description: form.description || undefined, tags: form.tags.length > 0 ? form.tags : undefined,
      registrationRegion: form.registrationRegion, includedPlates: form.includedPlates.length > 0 ? form.includedPlates : undefined,
      rightHandDrive: form.rightHandDrive, photoUrls: form.photoUrls.length > 0 ? form.photoUrls : undefined,
    } as any);
  };

  const setField = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);
  const toggleTag = useCallback((tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag] }));
  }, []);
  const togglePlate = useCallback((val: string) => {
    setForm(prev => ({ ...prev, includedPlates: prev.includedPlates.includes(val) ? prev.includedPlates.filter(p => p !== val) : [...prev.includedPlates, val] }));
  }, []);

  if (!isLoggedIn) {
    return (
      <View style={s.guestWrap}>
        <Text style={s.guestIcon}>🚗</Text>
        <Text style={s.guestTitle}>登入後即可發佈車源</Text>
        <Text style={s.guestSub}>免費發佈，快速出售您的愛車</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login' as any)}>
          <Text style={s.loginBtnText}>立即登入</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: APP_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Text style={s.headerTitle}>發佈車源</Text>
        <TouchableOpacity onPress={() => router.push('/my-posts' as any)} style={s.myPostsBtn}>
          <Text style={s.myPostsBtnText}>我的車源</Text>
        </TouchableOpacity>
      </View>
      <View style={s.tabBar}>
        {([
          { key: 'ai' as PostTab, label: '✨ 智能識別' },
          { key: 'search' as PostTab, label: '🔍 搜索選擇' },
          { key: 'manual' as PostTab, label: '✏️ 手動填寫' },
        ]).map(tab => (
          <TouchableOpacity key={tab.key} style={[s.tabBtn, activeTab === tab.key && s.tabBtnActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
            <Text style={[s.tabBtnText, activeTab === tab.key && s.tabBtnTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* AI Tab */}
        {activeTab === 'ai' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>✨ 智能識別</Text>
            <Text style={s.cardDesc}>貼上車源描述文字（支持微信群/Facebook格式），自動識別品牌、型號、年份、里程等信息</Text>
            <View style={s.typeRow}>
              {(['car', 'motorcycle'] as VehicleType[]).map(type => (
                <TouchableOpacity key={type} style={[s.typeBtn, form.vehicleType === type && s.typeBtnActive]} onPress={() => setField('vehicleType', type)} activeOpacity={0.8}>
                  <Text style={[s.typeBtnText, form.vehicleType === type && s.typeBtnTextActive]}>{type === 'car' ? '🚗 汽車' : '🏍️ 電單車'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[s.textarea, { marginTop: 12, minHeight: 120 }]} placeholder="例：2022年 Nissan X-Trail 珍珠白 26000km 自動波 HKD 132,000 澳門牌 可試車..." placeholderTextColor={APP_GRAY} multiline numberOfLines={6} textAlignVertical="top" value={aiText} onChangeText={setAiText} />
            <TouchableOpacity style={[s.submitBtn, isParsing && s.submitBtnDisabled, { marginHorizontal: 0, marginTop: 12 }]} onPress={handleAiParse} disabled={isParsing} activeOpacity={0.8}>
              {isParsing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={16} color="#fff" />}
              <Text style={s.submitBtnText}>{isParsing ? '識別中...' : '開始智能識別'}</Text>
            </TouchableOpacity>
            {autoFilledFields.size > 0 && (
              <View style={s.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={s.successBannerText}>已自動填充 {autoFilledFields.size} 個字段，已切換到手動填寫頁核對</Text>
              </View>
            )}
          </View>
        )}

        {/* 搜索 Tab */}
        {activeTab === 'search' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🔍 搜索選擇款式</Text>
            <View style={s.typeRow}>
              {(['car', 'motorcycle'] as VehicleType[]).map(type => (
                <TouchableOpacity key={type} style={[s.typeBtn, form.vehicleType === type && s.typeBtnActive]} onPress={() => setField('vehicleType', type)} activeOpacity={0.8}>
                  <Text style={[s.typeBtnText, form.vehicleType === type && s.typeBtnTextActive]}>{type === 'car' ? '🚗 汽車' : '🏍️ 電單車'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.inputRow, { marginTop: 12 }]}>
              <Ionicons name="search" size={16} color={APP_GRAY} style={{ marginRight: 8 }} />
              <TextInput style={s.searchInput} placeholder="搜索品牌、車系或款式（如：BMW 3系 320i）" placeholderTextColor={APP_GRAY} value={searchQuery} onChangeText={setSearchQuery} autoFocus />
              {searchQuery.length > 0 && <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchDebounced(''); }}><Ionicons name="close-circle" size={18} color={APP_GRAY} /></TouchableOpacity>}
            </View>
            {searchDebounced.length >= 1 && (
              <View style={s.searchResultsWrap}>
                {!searchResults ? (
                  <ActivityIndicator color={APP_ORANGE} style={{ marginVertical: 16 }} />
                ) : (searchResults as any[]).length === 0 ? (
                  <Text style={s.emptyText}>找不到相關款式，請嘗試其他關鍵字</Text>
                ) : (
                  (searchResults as any[]).map((item: any) => (
                    <TouchableOpacity key={item.id} style={s.searchResultItem} onPress={() => handleSelectSearchResult(item)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.searchResultName}>{item.brandNameZh || item.brandName} {item.seriesName} {item.modelName || item.name}</Text>
                        {item.dsatModelYear && <Text style={s.searchResultSub}>{item.dsatModelYear}年款</Text>}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={APP_GRAY} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            {form.modelName ? (
              <View style={[s.successBanner, { marginTop: 12 }]}>
                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                <Text style={[s.successBannerText, { flex: 1 }]}>已選：{form.brandName} {form.modelName}</Text>
                <TouchableOpacity onPress={() => setActiveTab('manual')} style={{ backgroundColor: '#15803D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>繼續填寫 →</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}

        {/* 手動填寫 Tab */}
        {activeTab === 'manual' && (
          <>
            {/* 車輛類型 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>車輛類型</Text>
              <View style={s.typeRow}>
                {(['car', 'motorcycle'] as VehicleType[]).map(type => (
                  <TouchableOpacity key={type} style={[s.typeBtn, form.vehicleType === type && s.typeBtnActive]} onPress={() => { setField('vehicleType', type); setField('brandId', null); setField('brandName', ''); setField('seriesId', null); setField('seriesName', ''); setField('modelId', null); setField('modelName', ''); }} activeOpacity={0.8}>
                    <Text style={[s.typeBtnText, form.vehicleType === type && s.typeBtnTextActive]}>{type === 'car' ? '🚗 汽車' : '🏍️ 電單車'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 品牌/車系/款式 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>品牌 / 車系 / 款式</Text>
              <Text style={s.fieldLabel}>品牌 <Text style={s.required}>*</Text></Text>
              <TouchableOpacity style={s.selectBtn} onPress={() => setShowBrandModal(true)} activeOpacity={0.8}>
                <Text style={form.brandName ? s.selectBtnText : s.selectBtnPlaceholder}>{form.brandName || '選擇品牌'}</Text>
                <Ionicons name="chevron-down" size={16} color={APP_GRAY} />
              </TouchableOpacity>
              {form.brandId && (<>
                <Text style={[s.fieldLabel, { marginTop: 10 }]}>車系</Text>
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowSeriesModal(true)} activeOpacity={0.8}>
                  <Text style={(form.seriesName || form.seriesId) ? s.selectBtnText : s.selectBtnPlaceholder}>{form.seriesName || (form.seriesId ? '（已自動選擇）' : '選擇車系')}</Text>
                  <Ionicons name="chevron-down" size={16} color={APP_GRAY} />
                </TouchableOpacity>
              </>)}
              {form.seriesId && (<>
                <Text style={[s.fieldLabel, { marginTop: 10 }]}>款式</Text>
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowModelModal(true)} activeOpacity={0.8}>
                  <Text style={form.modelName ? s.selectBtnText : s.selectBtnPlaceholder}>{form.modelName || '選擇款式'}</Text>
                  <Ionicons name="chevron-down" size={16} color={APP_GRAY} />
                </TouchableOpacity>
              </>)}
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>副標題（如：1.5T 渦輪）</Text>
              <TextInput style={s.input} placeholder="可選，顯示在標題下方" placeholderTextColor={APP_GRAY} value={form.subtitle} onChangeText={v => setField('subtitle', v)} />
            </View>

            {/* 基本信息 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>基本信息</Text>
              <View style={s.row2}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>出廠年份 <Text style={s.required}>*</Text>{autoFilledFields.has('year') && <Text style={s.autoTag}> 自動填充</Text>}</Text>
                  <TextInput style={s.input} placeholder="2020" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.year} onChangeText={v => setField('year', v)} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>里程(km) <Text style={s.required}>*</Text></Text>
                  <TextInput style={s.input} placeholder="35000" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.mileage} onChangeText={v => setField('mileage', v)} />
                </View>
              </View>
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>變速箱{autoFilledFields.has('transmission') && <Text style={s.autoTag}> 自動填充</Text>}</Text>
              <View style={s.typeRow}>
                {(['auto', 'manual'] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.typeBtn, form.transmission === t && s.typeBtnActive]} onPress={() => setField('transmission', t)} activeOpacity={0.8}>
                    <Text style={[s.typeBtnText, form.transmission === t && s.typeBtnTextActive]}>{t === 'auto' ? '自動波' : '手波'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>能源{autoFilledFields.has('fuelType') && <Text style={s.autoTag}> 自動填充</Text>}</Text>
              <View style={s.fuelRow}>
                {FUEL_TYPES.map(ft => (
                  <TouchableOpacity key={ft.value} style={[s.fuelBtn, form.fuelType === ft.value && s.fuelBtnActive]} onPress={() => setField('fuelType', ft.value)} activeOpacity={0.8}>
                    <Text style={[s.fuelBtnText, form.fuelType === ft.value && s.fuelBtnTextActive]}>{ft.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[s.row2, { marginTop: 10 }]}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>座位數{autoFilledFields.has('seats') && <Text style={s.autoTag}> 自動填充</Text>}</Text>
                  <TextInput style={s.input} placeholder="5" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.seats} onChangeText={v => setField('seats', v)} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>排氣量(cc){autoFilledFields.has('engineCapacity') && <Text style={s.autoTag}> 自動填充</Text>}</Text>
                  <TextInput style={s.input} placeholder="1998" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.engineCapacity} onChangeText={v => setField('engineCapacity', v)} />
                </View>
              </View>
            </View>

            {/* 車身顏色 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>車身顏色</Text>
              {dbColors && (dbColors as any[]).length > 0 ? (
                <View style={s.colorRow}>
                  {(dbColors as any[]).map((c: any) => (
                    <TouchableOpacity key={c.id} style={s.colorItem} onPress={() => setField('color', form.color === c.name ? '' : c.name)} activeOpacity={0.8}>
                      <View style={[s.colorDot, { backgroundColor: c.hex || '#ccc', borderWidth: form.color === c.name ? 3 : 1.5, borderColor: form.color === c.name ? APP_ORANGE : '#ddd' }]} />
                      <Text style={[s.colorLabel, form.color === c.name && { color: APP_ORANGE, fontWeight: '600' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput style={s.input} placeholder="如：珍珠白、深空灰" placeholderTextColor={APP_GRAY} value={form.color} onChangeText={v => setField('color', v)} />
              )}
            </View>

            {/* 配置亮點 */}
            {vehicleTags.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>配置亮點</Text>
                <View style={s.tagsWrap}>
                  {vehicleTags.map((tag: any) => (
                    <TouchableOpacity key={tag.id} style={[s.tagBtn, form.tags.includes(tag.name) && s.tagBtnActive]} onPress={() => toggleTag(tag.name)} activeOpacity={0.8}>
                      <Text style={[s.tagBtnText, form.tags.includes(tag.name) && s.tagBtnTextActive]}>{tag.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 售價 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>售價</Text>
              <View style={s.row2}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>預期售價(HKD/MOP) <Text style={s.required}>*</Text></Text>
                  <TextInput style={s.input} placeholder="132000" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.price} onChangeText={v => setField('price', v)} />
                </View>
                {/* 新車含稅價：自動回填時才顯示，用戶不需手動填 */}
                {(form.originalPrice || autoFilledFields.has('originalPrice')) && (
                  <View style={s.col2}>
                    <Text style={s.fieldLabel}>新車含稅價<Text style={s.autoTag}> 自動填充</Text></Text>
                    <TextInput style={s.input} placeholder="可選" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={form.originalPrice} onChangeText={v => setField('originalPrice', v)} />
                  </View>
                )}
              </View>
            </View>

            {/* 登記地/牌照 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>登記地 / 牌照</Text>
              <Text style={s.fieldLabel}>車輛出生地</Text>
              <View style={s.typeRow}>
                {REGISTRATION_REGIONS.map(r => (
                  <TouchableOpacity key={r.value} style={[s.typeBtn, form.registrationRegion === r.value && s.typeBtnActive]} onPress={() => setField('registrationRegion', r.value as any)} activeOpacity={0.8}>
                    <Text style={[s.typeBtnText, form.registrationRegion === r.value && s.typeBtnTextActive]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {form.vehicleType === 'car' && (<>
                <Text style={[s.fieldLabel, { marginTop: 10 }]}>跨境牌照</Text>
                <View style={s.platesWrap}>
                  {INCLUDED_PLATES_OPTIONS.map(p => (
                    <TouchableOpacity key={p.value} style={[s.plateBtn, form.includedPlates.includes(p.value) && s.plateBtnActive]} onPress={() => togglePlate(p.value)} activeOpacity={0.8}>
                      <Text style={[s.plateBtnText, form.includedPlates.includes(p.value) && s.plateBtnTextActive]}>{p.label}</Text>
                      <Text style={s.plateBtnDesc}>{p.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.switchRow}>
                  <Text style={s.fieldLabel}>右軚</Text>
                  <Switch value={form.rightHandDrive} onValueChange={v => setField('rightHandDrive', v)} trackColor={{ true: APP_ORANGE }} />
                </View>
              </>)}
            </View>

            {/* 圖片上傳 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>車輛圖片（最多 10 張）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={s.photoRow}>
                  {form.photoUrls.map((photo, i) => (
                    <View key={i} style={s.photoThumb}>
                      <Image source={{ uri: resolveImageUrl(photo.url) || photo.url }} style={s.photoImg} contentFit="cover" />
                      {i === 0 && <View style={s.coverBadge}><Text style={s.coverBadgeText}>封面</Text></View>}
                      <TouchableOpacity style={s.photoRemove} onPress={() => setForm(prev => ({ ...prev, photoUrls: prev.photoUrls.filter((_, idx) => idx !== i) }))}>
                        <Ionicons name="close" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {form.photoUrls.length < 10 && (
                    <TouchableOpacity style={s.photoAdd} onPress={handlePickPhoto} activeOpacity={0.8}>
                      {uploadMutation.isPending ? <ActivityIndicator color={APP_ORANGE} size="small" /> : (<><Ionicons name="camera" size={22} color={APP_GRAY} /><Text style={s.photoAddText}>上傳</Text></>)}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* 描述/聯繫 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>描述 / 聯繫</Text>
              <TextInput style={s.textarea} placeholder="補充車況、保養記錄、配置亮點等（最多 1000 字）" placeholderTextColor={APP_GRAY} multiline numberOfLines={4} textAlignVertical="top" maxLength={1000} value={form.description} onChangeText={v => setField('description', v)} />
              <View style={[s.row2, { marginTop: 10 }]}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>聯絡電話</Text>
                  <TextInput style={s.input} placeholder="手機號碼" placeholderTextColor={APP_GRAY} keyboardType="phone-pad" value={form.contactPhone} onChangeText={v => setField('contactPhone', v)} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>看車地址</Text>
                  <TextInput style={s.input} placeholder="如：澳門..." placeholderTextColor={APP_GRAY} value={form.address} onChangeText={v => setField('address', v)} />
                </View>
              </View>
            </View>

            {/* 提交 */}
            <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
              <Text style={s.submitBtnText}>{submitting ? '提交中...' : '提交發佈'}</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* 品牌 Modal */}
      <Modal visible={showBrandModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>選擇品牌</Text>
              <TouchableOpacity onPress={() => setShowBrandModal(false)}><Ionicons name="close" size={22} color={APP_TEXT} /></TouchableOpacity>
            </View>
            <View style={s.modalSearchWrap}>
              <Ionicons name="search" size={15} color={APP_GRAY} style={{ marginRight: 6 }} />
              <TextInput style={s.modalSearchInput} placeholder="搜索品牌..." placeholderTextColor={APP_GRAY} value={brandSearch} onChangeText={setBrandSearch} />
            </View>
            <FlatList data={filteredBrands} keyExtractor={(item: any) => String(item.id)} renderItem={({ item }: { item: any }) => (
              <TouchableOpacity style={s.modalItem} onPress={() => { setField('brandId', item.id); setField('brandName', item.brandNameZh || item.name); setField('seriesId', null); setField('seriesName', ''); setField('modelId', null); setField('modelName', ''); setBrandSearch(''); setShowBrandModal(false); }}>
                <Text style={s.modalItemText}>{item.brandNameZh || item.name}{item.name !== item.brandNameZh ? ` (${item.name})` : ''}</Text>
                {form.brandId === item.id && <Ionicons name="checkmark" size={18} color={APP_ORANGE} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      {/* 車系 Modal */}
      <Modal visible={showSeriesModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>選擇車系</Text>
              <TouchableOpacity onPress={() => setShowSeriesModal(false)}><Ionicons name="close" size={22} color={APP_TEXT} /></TouchableOpacity>
            </View>
            <FlatList data={seriesList as any[] || []} keyExtractor={(item: any) => String(item.id)} renderItem={({ item }: { item: any }) => (
              <TouchableOpacity style={s.modalItem} onPress={() => { setField('seriesId', item.id); setField('seriesName', item.name); setField('modelId', null); setField('modelName', ''); setShowSeriesModal(false); }}>
                <Text style={s.modalItemText}>{item.name}</Text>
                {form.seriesId === item.id && <Ionicons name="checkmark" size={18} color={APP_ORANGE} />}
              </TouchableOpacity>
            )} ListEmptyComponent={<Text style={s.emptyText}>暫無車系數據</Text>} />
          </View>
        </View>
      </Modal>

      {/* 款式 Modal */}
      <Modal visible={showModelModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>選擇款式</Text>
              <TouchableOpacity onPress={() => setShowModelModal(false)}><Ionicons name="close" size={22} color={APP_TEXT} /></TouchableOpacity>
            </View>
            <FlatList data={modelsList as any[] || []} keyExtractor={(item: any) => String(item.id)} renderItem={({ item }: { item: any }) => (
              <TouchableOpacity style={s.modalItem} onPress={() => { setField('modelId', item.id); setField('modelName', item.name || item.modelName); setShowModelModal(false); }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalItemText}>{item.name || item.modelName}</Text>
                  {item.dsatModelYear && <Text style={s.modalItemSub}>{item.dsatModelYear}年款</Text>}
                </View>
                {form.modelId === item.id && <Ionicons name="checkmark" size={18} color={APP_ORANGE} />}
              </TouchableOpacity>
            )} ListEmptyComponent={<Text style={s.emptyText}>暫無款式數據</Text>} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: APP_BG, padding: 32 },
  guestIcon: { fontSize: 48, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 8, textAlign: 'center' },
  guestSub: { fontSize: 14, color: APP_GRAY, marginBottom: 24, textAlign: 'center' },
  loginBtn: { backgroundColor: APP_ORANGE, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  headerTitle: { fontSize: 18, fontWeight: '700', color: APP_TEXT },
  myPostsBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: APP_ORANGE },
  myPostsBtnText: { fontSize: 13, fontWeight: '600', color: APP_ORANGE },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f7' },
  tabBtnActive: { backgroundColor: APP_ORANGE },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: APP_GRAY },
  tabBtnTextActive: { color: '#fff' },
  scroll: { flex: 1, backgroundColor: APP_BG },
  card: { backgroundColor: '#fff', borderRadius: 16, margin: 12, marginBottom: 0, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  cardDesc: { fontSize: 13, color: APP_GRAY, marginBottom: 12, lineHeight: 18 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff' },
  typeBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}15` },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: APP_GRAY },
  typeBtnTextActive: { color: APP_ORANGE },
  fieldLabel: { fontSize: 13, color: '#6B7280', marginBottom: 6, fontWeight: '500' },
  required: { color: APP_ORANGE, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  autoTag: { color: '#15803D', fontSize: 11 },
  input: { borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: APP_TEXT, backgroundColor: '#fafafa' },
  textarea: { borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 10, padding: 12, fontSize: 14, color: APP_TEXT, minHeight: 90, backgroundColor: '#fafafa' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fafafa' },
  selectBtnText: { fontSize: 14, color: APP_TEXT },
  selectBtnPlaceholder: { fontSize: 14, color: APP_GRAY },
  row2: { flexDirection: 'row', gap: 10 },
  col2: { flex: 1 },
  fuelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fuelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff' },
  fuelBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}15` },
  fuelBtnText: { fontSize: 13, color: APP_GRAY },
  fuelBtnTextActive: { color: APP_ORANGE, fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  colorItem: { alignItems: 'center', gap: 4 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorLabel: { fontSize: 11, color: APP_GRAY },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff' },
  tagBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}15` },
  tagBtnText: { fontSize: 13, color: APP_GRAY },
  tagBtnTextActive: { color: APP_ORANGE, fontWeight: '600' },
  platesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plateBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff', alignItems: 'center' },
  plateBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}15` },
  plateBtnText: { fontSize: 13, fontWeight: '600', color: APP_GRAY },
  plateBtnTextActive: { color: APP_ORANGE },
  plateBtnDesc: { fontSize: 10, color: APP_GRAY, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: 72, height: 72 },
  coverBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: APP_ORANGE, paddingHorizontal: 4, paddingVertical: 2, borderBottomRightRadius: 6 },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  photoRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 2 },
  photoAdd: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, borderColor: APP_BORDER, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddText: { fontSize: 11, color: APP_GRAY },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: APP_ORANGE, borderRadius: 16, marginHorizontal: 12, marginTop: 16, paddingVertical: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 10, marginTop: 10 },
  successBannerText: { fontSize: 13, color: '#15803D' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
  searchInput: { flex: 1, fontSize: 14, color: APP_TEXT },
  searchResultsWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: APP_BORDER, marginTop: 4 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fff' },
  searchResultName: { fontSize: 14, color: APP_TEXT, fontWeight: '500' },
  searchResultSub: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  emptyText: { textAlign: 'center', color: APP_GRAY, padding: 20, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  modalTitle: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  modalSearchWrap: { flexDirection: 'row', alignItems: 'center', margin: 12, borderWidth: 1, borderColor: APP_BORDER, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fafafa' },
  modalSearchInput: { flex: 1, fontSize: 14, color: APP_TEXT },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  modalItemText: { fontSize: 15, color: APP_TEXT },
  modalItemSub: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
});
