/**
 * 編輯車源頁 — vehicle/edit/[id].tsx
 * 對照 WebApp AppPostEdit.tsx，超越 WebApp 的原生體驗
 * 支持：照片管理/排序、配置標籤、登記信息、更多車輛信息
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { trpc, resolveImageUrl } from '../../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../../constants/data';

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

interface PhotoItem { id?: number; url: string; sortOrder: number; isNew?: boolean; }

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const postId = Number(id);

  // 基本字段
  const [price, setPrice] = useState('');
  const [mileage, setMileage] = useState('');
  const [transmission, setTransmission] = useState<'auto' | 'manual'>('auto');
  const [color, setColor] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [description, setDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // 登記信息
  const [plateNumber, setPlateNumber] = useState('');
  const [firstRegDate, setFirstRegDate] = useState('');
  const [transferCount, setTransferCount] = useState('');
  // 更多信息
  const [vin, setVin] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [frontTire, setFrontTire] = useState('');
  const [rearTire, setRearTire] = useState('');
  // 牌照
  const [registrationRegion, setRegistrationRegion] = useState<'macau' | 'hongkong' | 'guangdong'>('macau');
  const [includedPlates, setIncludedPlates] = useState<string[]>([]);
  const [rightHandDrive, setRightHandDrive] = useState(false);
  // 照片
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);

  const { data, isLoading, error } = trpc.vehicle.getPostById.useQuery(
    { id: postId },
    { enabled: !!postId && postId > 0 }
  );
  const uploadMutation = trpc.vehicle.uploadFile.useMutation();
  const updateMutation = trpc.vehicle.updatePost.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      Alert.alert('保存成功', '車源信息已更新', [
        { text: '查看車源', onPress: () => router.push(`/vehicle/${postId}` as any) },
        { text: '繼續編輯', style: 'cancel' },
      ]);
    },
    onError: (err: any) => {
      setIsSaving(false);
      Alert.alert('保存失敗', err.message || '請稍後重試');
    },
  });

  const { data: dbTags } = trpc.vehicle.getActiveTags.useQuery();
  const { data: dbColors } = trpc.vehicle.getActiveColors.useQuery();

  const vehicleTags = useMemo(() => {
    if (!dbTags) return [];
    return (dbTags as any[]).filter((t: any) => t.category === 'vehicle');
  }, [dbTags]);

  // 初始化表單
  useEffect(() => {
    if (!data) return;
    const { post, photos: dbPhotos } = data as any;
    setPrice(post.price ? String(Number(post.price)) : '');
    setMileage(post.mileage ? String(post.mileage) : '');
    setTransmission((post.transmission as 'auto' | 'manual') || 'auto');
    setColor(post.color || '');
    setFuelType(post.fuelType || '');
    setDescription(post.description || '');
    setContactPhone(post.contactPhone || '');
    setAddress(post.address || '');
    setSelectedTags((post.tags as string[]) || []);
    setPlateNumber(post.plateNumber || '');
    setFirstRegDate(post.firstRegDate || '');
    setTransferCount(post.transferCount != null ? String(post.transferCount) : '');
    setVin(post.vin || '');
    setOriginCountry(post.originCountry || '');
    setFrontTire(post.frontTire || '');
    setRearTire(post.rearTire || '');
    setRegistrationRegion(post.registrationRegion || 'macau');
    setIncludedPlates(post.includedPlates || []);
    setRightHandDrive(post.rightHandDrive || false);
    if (dbPhotos && dbPhotos.length > 0) {
      setPhotos(dbPhotos.map((p: any, idx: number) => ({ id: p.id, url: p.url, sortOrder: idx })));
    }
  }, [data]);

  const handlePickPhoto = async () => {
    if (photos.length >= 20) { Alert.alert('提示', '最多上傳 20 張圖片'); return; }
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
          setPhotos(prev => [...prev, { url: (uploaded as any).url, sortOrder: prev.length, isNew: true }]);
        } catch {
          Alert.alert('上傳失敗', '圖片上傳失敗，請重試');
        }
      }
    }
  };

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);
  const togglePlate = useCallback((val: string) => {
    setIncludedPlates(prev => prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]);
  }, []);

  const handleSave = () => {
    if (!price || Number(price) <= 0) { Alert.alert('提示', '請輸入有效售價'); return; }
    setIsSaving(true);
    updateMutation.mutate({
      postId,
      price: Number(price),
      mileage: mileage ? Number(mileage) : undefined,
      transmission,
      color: color || undefined,
      contactPhone: contactPhone || undefined,
      description: description || undefined,
      tags: selectedTags,
      plateNumber: plateNumber || undefined,
      firstRegDate: firstRegDate || undefined,
      transferCount: transferCount ? Number(transferCount) : undefined,
      vin: vin || undefined,
      originCountry: originCountry || undefined,
      frontTire: frontTire || undefined,
      rearTire: rearTire || undefined,
      registrationRegion,
      includedPlates: includedPlates.length > 0 ? (includedPlates as any) : undefined,
      rightHandDrive,
      photos: photos.map((p, idx) => ({ id: p.id, url: p.url, sortOrder: idx })),
    } as any);
  };

  if (isLoading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={APP_ORANGE} size="large" />
        <Text style={s.loadingText}>載入中...</Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="alert-circle-outline" size={48} color={APP_GRAY} />
        <Text style={s.errorText}>找不到該車源或無權編輯</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.push('/my-posts' as any)}>
          <Text style={s.backBtnText}>返回我的車源</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const post = (data as any).post;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: APP_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>編輯車源</Text>
        <TouchableOpacity onPress={() => router.push(`/vehicle/${postId}` as any)}>
          <Text style={s.previewBtn}>預覽</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 車源標題（只讀） */}
        <View style={s.card}>
          <View style={s.titleRow}>
            <View style={s.titleInfo}>
              <Text style={s.titleText}>{post.brandName} {post.modelName}</Text>
              {post.subtitle && <Text style={s.subtitleText}>{post.subtitle}</Text>}
              <Text style={s.titleSub}>編號 {post.postNumber || `GG-${String(postId).padStart(6, '0')}`}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: post.status === 'active' ? '#DCFCE7' : '#FEF3C7' }]}>
              <Text style={[s.statusText, { color: post.status === 'active' ? '#15803D' : '#B45309' }]}>
                {post.status === 'active' ? '在售' : post.status === 'pending' ? '審核中' : post.status === 'draft' ? '草稿' : post.status}
              </Text>
            </View>
          </View>
        </View>

        {/* 照片管理 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>車輛照片（最多 20 張）</Text>
          <Text style={s.sectionDesc}>第一張為封面，長按可刪除</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={s.photoRow}>
              {photos.map((photo, i) => (
                <TouchableOpacity
                  key={photo.url + i}
                  style={s.photoThumb}
                  onLongPress={() => {
                    Alert.alert('刪除照片', '確定刪除此照片？', [
                      { text: '刪除', style: 'destructive', onPress: () => setPhotos(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, sortOrder: idx }))) },
                      { text: '取消', style: 'cancel' },
                    ]);
                  }}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: resolveImageUrl(photo.url) || photo.url }} style={s.photoImg} contentFit="cover" />
                  {i === 0 && <View style={s.coverBadge}><Text style={s.coverBadgeText}>封面</Text></View>}
                  <TouchableOpacity
                    style={s.photoRemove}
                    onPress={() => setPhotos(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, sortOrder: idx })))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={10} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {photos.length < 20 && (
                <TouchableOpacity style={s.photoAdd} onPress={handlePickPhoto} activeOpacity={0.8}>
                  {uploadMutation.isPending ? (
                    <ActivityIndicator color={APP_ORANGE} size="small" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={22} color={APP_GRAY} />
                      <Text style={s.photoAddText}>上傳</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 基本信息 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>基本信息</Text>
          <View style={s.row2}>
            <View style={s.col2}>
              <Text style={s.fieldLabel}>預期售價(HKD) <Text style={s.required}>*</Text></Text>
              <TextInput style={s.input} placeholder="132000" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={price} onChangeText={setPrice} />
            </View>
            <View style={s.col2}>
              <Text style={s.fieldLabel}>里程(km)</Text>
              <TextInput style={s.input} placeholder="26000" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={mileage} onChangeText={setMileage} />
            </View>
          </View>
          <Text style={[s.fieldLabel, { marginTop: 10 }]}>變速箱</Text>
          <View style={s.typeRow}>
            {(['auto', 'manual'] as const).map(t => (
              <TouchableOpacity key={t} style={[s.typeBtn, transmission === t && s.typeBtnActive]} onPress={() => setTransmission(t)} activeOpacity={0.8}>
                <Text style={[s.typeBtnText, transmission === t && s.typeBtnTextActive]}>{t === 'auto' ? '自動波' : '手波'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: 10 }]}>能源</Text>
          <View style={s.fuelRow}>
            {FUEL_TYPES.map(ft => (
              <TouchableOpacity key={ft.value} style={[s.fuelBtn, fuelType === ft.value && s.fuelBtnActive]} onPress={() => setFuelType(ft.value)} activeOpacity={0.8}>
                <Text style={[s.fuelBtnText, fuelType === ft.value && s.fuelBtnTextActive]}>{ft.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 車身顏色 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>車身顏色</Text>
          {dbColors && (dbColors as any[]).length > 0 ? (
            <View style={s.colorRow}>
              {(dbColors as any[]).map((c: any) => (
                <TouchableOpacity key={c.id} style={s.colorItem} onPress={() => setColor(color === c.name ? '' : c.name)} activeOpacity={0.8}>
                  <View style={[s.colorDot, { backgroundColor: c.hex || '#ccc', borderWidth: color === c.name ? 3 : 1.5, borderColor: color === c.name ? APP_ORANGE : '#ddd' }]} />
                  <Text style={[s.colorLabel, color === c.name && { color: APP_ORANGE, fontWeight: '600' }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput style={s.input} placeholder="如：珍珠白、深空灰" placeholderTextColor={APP_GRAY} value={color} onChangeText={setColor} />
          )}
        </View>

        {/* 配置亮點 */}
        {vehicleTags.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>配置亮點</Text>
            <View style={s.tagsWrap}>
              {vehicleTags.map((tag: any) => (
                <TouchableOpacity key={tag.id} style={[s.tagBtn, selectedTags.includes(tag.name) && s.tagBtnActive]} onPress={() => toggleTag(tag.name)} activeOpacity={0.8}>
                  <Text style={[s.tagBtnText, selectedTags.includes(tag.name) && s.tagBtnTextActive]}>{tag.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 登記地/牌照 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>登記地 / 牌照</Text>
          <Text style={s.fieldLabel}>車輛出生地</Text>
          <View style={s.typeRow}>
            {REGISTRATION_REGIONS.map(r => (
              <TouchableOpacity key={r.value} style={[s.typeBtn, registrationRegion === r.value && s.typeBtnActive]} onPress={() => setRegistrationRegion(r.value as any)} activeOpacity={0.8}>
                <Text style={[s.typeBtnText, registrationRegion === r.value && s.typeBtnTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: 10 }]}>跨境牌照</Text>
          <View style={s.platesWrap}>
            {INCLUDED_PLATES_OPTIONS.map(p => (
              <TouchableOpacity key={p.value} style={[s.plateBtn, includedPlates.includes(p.value) && s.plateBtnActive]} onPress={() => togglePlate(p.value)} activeOpacity={0.8}>
                <Text style={[s.plateBtnText, includedPlates.includes(p.value) && s.plateBtnTextActive]}>{p.label}</Text>
                <Text style={s.plateBtnDesc}>{p.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.switchRow}>
            <Text style={s.fieldLabel}>右軚</Text>
            <Switch value={rightHandDrive} onValueChange={setRightHandDrive} trackColor={{ true: APP_ORANGE }} />
          </View>
        </View>

        {/* 描述/聯繫 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>描述 / 聯繫</Text>
          <TextInput style={s.textarea} placeholder="補充車況、保養記錄、配置亮點等（最多 2000 字）" placeholderTextColor={APP_GRAY} multiline numberOfLines={4} textAlignVertical="top" maxLength={2000} value={description} onChangeText={setDescription} />
          <View style={[s.row2, { marginTop: 10 }]}>
            <View style={s.col2}>
              <Text style={s.fieldLabel}>聯絡電話</Text>
              <TextInput style={s.input} placeholder="手機號碼" placeholderTextColor={APP_GRAY} keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
            </View>
            <View style={s.col2}>
              <Text style={s.fieldLabel}>看車地址</Text>
              <TextInput style={s.input} placeholder="如：澳門..." placeholderTextColor={APP_GRAY} value={address} onChangeText={setAddress} />
            </View>
          </View>
        </View>

        {/* 更多信息（可展開） */}
        <View style={s.card}>
          <TouchableOpacity style={s.moreHeader} onPress={() => setMoreExpanded(!moreExpanded)} activeOpacity={0.8}>
            <Text style={s.sectionTitle}>登記 / 車架信息（選填）</Text>
            <Ionicons name={moreExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={APP_GRAY} />
          </TouchableOpacity>
          {moreExpanded && (
            <>
              <View style={s.row2}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>車牌號碼</Text>
                  <TextInput style={s.input} placeholder="如：MX-XXXX" placeholderTextColor={APP_GRAY} value={plateNumber} onChangeText={setPlateNumber} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>首次登記日期</Text>
                  <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={APP_GRAY} value={firstRegDate} onChangeText={setFirstRegDate} />
                </View>
              </View>
              <View style={[s.row2, { marginTop: 10 }]}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>過戶次數</Text>
                  <TextInput style={s.input} placeholder="0" placeholderTextColor={APP_GRAY} keyboardType="numeric" value={transferCount} onChangeText={setTransferCount} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>車架號(VIN)</Text>
                  <TextInput style={s.input} placeholder="17位車架號" placeholderTextColor={APP_GRAY} value={vin} onChangeText={setVin} />
                </View>
              </View>
              <View style={[s.row2, { marginTop: 10 }]}>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>前輪規格</Text>
                  <TextInput style={s.input} placeholder="如：225/55R17" placeholderTextColor={APP_GRAY} value={frontTire} onChangeText={setFrontTire} />
                </View>
                <View style={s.col2}>
                  <Text style={s.fieldLabel}>後輪規格</Text>
                  <TextInput style={s.input} placeholder="如：225/55R17" placeholderTextColor={APP_GRAY} value={rearTire} onChangeText={setRearTire} />
                </View>
              </View>
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>原產地</Text>
              <TextInput style={s.input} placeholder="如：日本、德國" placeholderTextColor={APP_GRAY} value={originCountry} onChangeText={setOriginCountry} />
            </>
          )}
        </View>

        {/* 保存按鈕 */}
        <TouchableOpacity style={[s.saveBtn, isSaving && s.saveBtnDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.85}>
          {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={s.saveBtnText}>{isSaving ? '保存中...' : '保存修改'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: APP_BG, gap: 12 },
  loadingText: { fontSize: 14, color: APP_GRAY },
  errorText: { fontSize: 15, color: APP_GRAY, marginTop: 8 },
  backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: APP_ORANGE, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  headerTitle: { fontSize: 17, fontWeight: '700', color: APP_TEXT },
  previewBtn: { fontSize: 14, fontWeight: '600', color: APP_ORANGE },
  card: { backgroundColor: '#fff', borderRadius: 16, margin: 12, marginBottom: 0, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: APP_TEXT, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: APP_GRAY, marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleInfo: { flex: 1 },
  titleText: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  subtitleText: { fontSize: 13, color: APP_GRAY, marginTop: 2 },
  titleSub: { fontSize: 12, color: APP_GRAY, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  fieldLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: '500' },
  required: { color: APP_ORANGE },
  input: { borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: APP_TEXT, backgroundColor: '#fafafa' },
  textarea: { borderWidth: 1.5, borderColor: APP_BORDER, borderRadius: 10, padding: 12, fontSize: 14, color: APP_TEXT, minHeight: 90, backgroundColor: '#fafafa' },
  row2: { flexDirection: 'row', gap: 10 },
  col2: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff' },
  typeBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}15` },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: APP_GRAY },
  typeBtnTextActive: { color: APP_ORANGE },
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
  photoThumb: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoImg: { width: 80, height: 80 },
  coverBadge: { position: 'absolute', top: 0, left: 0, backgroundColor: APP_ORANGE, paddingHorizontal: 4, paddingVertical: 2, borderBottomRightRadius: 6 },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  photoRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 2 },
  photoAdd: { width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: APP_BORDER, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddText: { fontSize: 11, color: APP_GRAY },
  moreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: APP_ORANGE, borderRadius: 16, marginHorizontal: 12, marginTop: 16, paddingVertical: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
