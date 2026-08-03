/**
 * 搜索篩選頁 — 對齊 WebApp /app/search
 * 三 Tab：搜索 / AI搜索 / 篩選
 * API: trpc.vehicle.publicHotSearches + trpc.vehicle.getBrandStats + trpc.vehicle.semanticSearch
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { trpc } from '../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../constants/data';

const HISTORY_KEY = 'gogocar_search_history';
type TabKey = 'search' | 'ai' | 'filter';

// ── 篩選 Tab 的選項 ──────────────────────────────────────────────
const VEHICLE_TYPES = [
  { label: '私家車', value: 'car' },
  { label: '電單車', value: 'motorcycle' },
];
const PRICE_OPTIONS = [
  { label: '不限', value: '' },
  { label: '10 萬以下', value: '0-100000' },
  { label: '10–30 萬', value: '100000-300000' },
  { label: '30–50 萬', value: '300000-500000' },
  { label: '50–100 萬', value: '500000-1000000' },
  { label: '100 萬以上', value: '1000000-' },
];
const AGE_OPTIONS = [
  { label: '不限', value: '' },
  { label: '3 年內', value: '3' },
  { label: '5 年內', value: '5' },
  { label: '10 年內', value: '10' },
];
const SORT_OPTIONS = [
  { label: '最新', value: 'newest' },
  { label: '價格低→高', value: 'price_asc' },
  { label: '價格高→低', value: 'price_desc' },
  { label: '里程最少', value: 'mileage_asc' },
];

export default function SearchScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('search');

  // ── 搜索 Tab state ──
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ── AI 搜索 Tab state ──
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState<{ summary: string; filters: Record<string, any> } | null>(null);

  // ── 篩選 Tab state ──
  const [filterVehicleType, setFilterVehicleType] = useState('');
  const [filterPrice, setFilterPrice] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [filterSort, setFilterSort] = useState('newest');

  // ── API ──
  const { data: hotData } = trpc.vehicle.publicHotSearches.useQuery();
  const { data: brandStatsData } = trpc.vehicle.getBrandStats.useQuery();
  const semanticMutation = trpc.vehicle.semanticSearch.useMutation({
    onSuccess: (data: any) => {
      setAiResult({ summary: data.summary, filters: data.filters });
    },
    onError: (err: any) => {
      Alert.alert('AI 搜索失敗', err.message || '請稍後重試');
    },
  });

  const hotList: { keyword: string; rank: number }[] = hotData || [];
  const brandList: { brandName: string; modelCount: number }[] = (brandStatsData || [])
    .filter((b: any) => b.brandName)
    .sort((a: any, b: any) => Number(b.modelCount) - Number(a.modelCount));
  const totalModels = brandList.reduce((s, b) => s + Number(b.modelCount), 0);

  // ── 載入搜索歷史 ──
  React.useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(v => {
      if (v) setHistory(JSON.parse(v));
    });
  }, []);

  const saveHistory = useCallback(async (kw: string) => {
    const next = [kw, ...history.filter(h => h !== kw)].slice(0, 10);
    setHistory(next);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }, [history]);

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  // ── 執行搜索 → 跳去買車頁 ──
  const doSearch = useCallback((kw: string) => {
    if (!kw.trim()) return;
    saveHistory(kw.trim());
    Keyboard.dismiss();
    router.push(`/(tabs)/buy?search=${encodeURIComponent(kw.trim())}` as any);
  }, [saveHistory, router]);

  // ── 語音輸入 ──
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const voiceMutation = trpc.voice.transcribe.useMutation({
    onSuccess: (data: any) => {
      setAiQuery(data.text || '');
      setIsTranscribing(false);
    },
    onError: (err: any) => {
      Alert.alert('語音識別失敗', err.message || '請稍後重試');
      setIsTranscribing(false);
    },
  });

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('需要麥克風權限', '請在設定中允許麥克風權限以使用語音搜索');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      Alert.alert('錄音失敗', '無法啟動麥克風');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      // 讀取檔案為 base64
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      // 調用後端 Whisper API
      voiceMutation.mutate({
        audioBase64: base64,
        filename: 'voice-search.m4a',
        contentType: 'audio/m4a',
      });
    } catch (err: any) {
      Alert.alert('語音處理失敗', err.message || '請重試');
      setIsTranscribing(false);
    }
  };

  // ── AI 搜索 ──
  const doAISearch = () => {
    if (!aiQuery.trim()) return;
    setAiResult(null);
    semanticMutation.mutate({ query: aiQuery.trim() });
  };

  const applyAIFilters = () => {
    if (!aiResult) return;
    const f = aiResult.filters;
    const parts: string[] = [];
    if (f.vehicleType) parts.push(`vehicleType=${f.vehicleType}`);
    if (f.brandName) parts.push(`brand=${encodeURIComponent(f.brandName)}`);
    if (f.minPrice !== undefined) parts.push(`minPrice=${f.minPrice}`);
    if (f.maxPrice !== undefined) parts.push(`maxPrice=${f.maxPrice}`);
    if (f.maxAge !== undefined) parts.push(`age=${f.maxAge}`);
    if (f.search) parts.push(`search=${encodeURIComponent(f.search)}`);
    if (f.sortBy && f.sortBy !== 'newest') parts.push(`sortBy=${f.sortBy}`);
    const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
    router.push(`/(tabs)/buy${qs}` as any);
  };

  // ── 套用篩選 ──
  const applyFilter = () => {
    const parts: string[] = [];
    if (filterVehicleType) parts.push(`vehicleType=${filterVehicleType}`);
    if (filterPrice) {
      const [min, max] = filterPrice.split('-');
      if (min) parts.push(`minPrice=${min}`);
      if (max) parts.push(`maxPrice=${max}`);
    }
    if (filterAge) parts.push(`age=${filterAge}`);
    if (filterSort && filterSort !== 'newest') parts.push(`sortBy=${filterSort}`);
    const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
    router.push(`/(tabs)/buy${qs}` as any);
  };

  const resetFilter = () => {
    setFilterVehicleType('');
    setFilterPrice('');
    setFilterAge('');
    setFilterSort('newest');
  };

  // ── 渲染 ──
  return (
    <View style={s.root}>
      {/* 頂部：返回 + 標題 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>搜索篩選</Text>
      </View>

      {/* 三 Tab 切換 */}
      <View style={s.tabRow}>
        {(['search', 'ai', 'filter'] as TabKey[]).map(t => {
          const active = tab === t;
          const label = t === 'search' ? '🔍 搜索' : t === 'ai' ? '✨ AI搜索' : '⚙️ 篩選';
          return (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabBtnText, active && s.tabBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ===== 搜索 Tab ===== */}
      {tab === 'search' && (
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* 搜索框 */}
          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                ref={inputRef}
                style={s.searchInput}
                placeholder="輸入品牌、車系、年份..."
                placeholderTextColor={APP_GRAY}
                value={keyword}
                onChangeText={setKeyword}
                returnKeyType="search"
                onSubmitEditing={() => doSearch(keyword)}
                autoFocus
              />
              {keyword.length > 0 && (
                <TouchableOpacity onPress={() => setKeyword('')} style={s.clearBtn}>
                  <Text style={s.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={s.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>

          {/* 熱門搜索 */}
          {hotList.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>熱門搜索</Text>
              <View style={s.tagWrap}>
                {hotList.map((item, i) => (
                  <TouchableOpacity
                    key={item.keyword}
                    style={[s.hotTag, i < 3 && s.hotTagTop]}
                    onPress={() => doSearch(item.keyword)}
                    activeOpacity={0.7}
                  >
                    {i < 3 && <Text style={s.hotRank}>{i + 1}</Text>}
                    <Text style={[s.hotTagText, i < 3 && s.hotTagTextTop]}>{item.keyword}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 搜索歷史 */}
          {history.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>搜索歷史</Text>
                <TouchableOpacity onPress={clearHistory} activeOpacity={0.7}>
                  <Text style={s.clearHistoryBtn}>清除</Text>
                </TouchableOpacity>
              </View>
              <View style={s.tagWrap}>
                {history.map(h => (
                  <TouchableOpacity key={h} style={s.historyTag} onPress={() => doSearch(h)} activeOpacity={0.7}>
                    <Text style={s.historyTagText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 按品牌瀏覽 */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>按品牌瀏覽</Text>
              <Text style={s.sectionSub}>全澳門 {totalModels.toLocaleString()} 個型號</Text>
            </View>
            <View style={s.brandList}>
              {brandList.slice(0, 30).map((b, i) => (
                <TouchableOpacity
                  key={b.brandName}
                  style={[s.brandRow, i > 0 && s.brandRowBorder]}
                  onPress={() => router.push(`/(tabs)/buy?brand=${encodeURIComponent(b.brandName)}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={s.brandLeft}>
                    <Text style={s.brandPin}>📍</Text>
                    <Text style={s.brandName}>{b.brandName}</Text>
                  </View>
                  <View style={s.brandRight}>
                    <Text style={s.brandCount}>{Number(b.modelCount).toLocaleString()} 個型號</Text>
                    <Text style={s.brandArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ===== AI 搜索 Tab ===== */}
      {tab === 'ai' && (
        <ScrollView style={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* AI 搜索框 */}
          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <Text style={s.searchIcon}>✨</Text>
              <TextInput
                style={s.searchInput}
                placeholder="描述你想要的車，例：預算30萬以內的日系SUV..."
                placeholderTextColor={APP_GRAY}
                value={aiQuery}
                onChangeText={setAiQuery}
                returnKeyType="search"
                onSubmitEditing={doAISearch}
                autoFocus={tab === 'ai'}
              />
              {aiQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setAiQuery(''); setAiResult(null); }} style={s.clearBtn}>
                  <Text style={s.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
                        {/* 麥克風按鈕 */}
            <TouchableOpacity
              style={[s.micBtn, isRecording && s.micBtnActive]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              activeOpacity={0.7}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={APP_ORANGE} />
              ) : (
                <Text style={[s.micIcon, isRecording && s.micIconActive]}>
                  {isRecording ? '⏹' : '🎙️'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={s.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
          {/* 語音提示 */}
          {isRecording && (
            <View style={s.recordingHint}>
              <Text style={s.recordingDot}>●</Text>
              <Text style={s.recordingText}>正在錄音… 請說出您想找的車（支援廣東話/普通話/英語/葡語）</Text>
            </View>
          )}
          {isTranscribing && (
            <View style={s.recordingHint}>
              <ActivityIndicator size="small" color={APP_ORANGE} />
              <Text style={s.recordingText}> AI 識別中…</Text>
            </View>
          )}
          {/* AI 搜索按鈕 */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TouchableOpacity
              style={[s.aiSearchBtn, (!aiQuery.trim() || semanticMutation.isPending) && s.aiSearchBtnDisabled]}
              onPress={doAISearch}
              disabled={!aiQuery.trim() || semanticMutation.isPending}
              activeOpacity={0.8}
            >
              {semanticMutation.isPending ? (
                <><ActivityIndicator size="small" color="#fff" /><Text style={s.aiSearchBtnText}> AI 分析中…</Text></>
              ) : (
                <Text style={s.aiSearchBtnText}>✨ AI 智能搜車</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* AI 分析結果 */}
          {aiResult && (
            <View style={s.aiResultCard}>
              <View style={s.aiResultHeader}>
                <Text style={s.aiResultIcon}>✅</Text>
                <Text style={s.aiResultTitle}>AI 分析完成</Text>
              </View>
              <Text style={s.aiResultSummary}>{aiResult.summary}</Text>
              {/* 篩選條件標籤 */}
              <View style={s.aiTagWrap}>
                {aiResult.filters.vehicleType && (
                  <View style={[s.aiTag, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                    <Text style={[s.aiTagText, { color: '#EA580C' }]}>
                      {aiResult.filters.vehicleType === 'car' ? '🚗 私家車' : '🏍️ 電單車'}
                    </Text>
                  </View>
                )}
                {aiResult.filters.brandName && (
                  <View style={[s.aiTag, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                    <Text style={[s.aiTagText, { color: '#2563EB' }]}>🏷️ {aiResult.filters.brandName}</Text>
                  </View>
                )}
                {aiResult.filters.maxPrice !== undefined && (
                  <View style={[s.aiTag, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                    <Text style={[s.aiTagText, { color: '#16A34A' }]}>
                      💰 最高 {(aiResult.filters.maxPrice / 10000).toFixed(0)} 萬
                    </Text>
                  </View>
                )}
                {aiResult.filters.maxAge !== undefined && (
                  <View style={[s.aiTag, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
                    <Text style={[s.aiTagText, { color: '#7C3AED' }]}>📅 {aiResult.filters.maxAge} 年內</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={s.applyAIBtn} onPress={applyAIFilters} activeOpacity={0.8}>
                <Text style={s.applyAIBtnText}>查看符合條件的車源 →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI 搜索提示 */}
          {!aiResult && !semanticMutation.isPending && (
            <View style={s.aiHintBox}>
              <Text style={s.aiHintTitle}>💡 AI 搜索示例</Text>
              {[
                '預算 30 萬以內的日系 SUV',
                '低里程自動波電動車',
                '5 年內寶馬 3 系，預算 50 萬',
                '七人座 MPV，適合家庭用',
              ].map(hint => (
                <TouchableOpacity key={hint} style={s.aiHintItem} onPress={() => setAiQuery(hint)} activeOpacity={0.7}>
                  <Text style={s.aiHintItemText}>→ {hint}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ===== 篩選 Tab ===== */}
      {tab === 'filter' && (
        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
          {/* 車輛類型 */}
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>車輛類型</Text>
            <View style={s.filterRow}>
              <TouchableOpacity
                style={[s.filterChip, filterVehicleType === '' && s.filterChipActive]}
                onPress={() => setFilterVehicleType('')}
                activeOpacity={0.7}
              >
                <Text style={[s.filterChipText, filterVehicleType === '' && s.filterChipTextActive]}>不限</Text>
              </TouchableOpacity>
              {VEHICLE_TYPES.map(vt => (
                <TouchableOpacity
                  key={vt.value}
                  style={[s.filterChip, filterVehicleType === vt.value && s.filterChipActive]}
                  onPress={() => setFilterVehicleType(vt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterChipText, filterVehicleType === vt.value && s.filterChipTextActive]}>{vt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 價格範圍 */}
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>價格範圍</Text>
            <View style={s.filterRow}>
              {PRICE_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[s.filterChip, filterPrice === p.value && s.filterChipActive]}
                  onPress={() => setFilterPrice(p.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterChipText, filterPrice === p.value && s.filterChipTextActive]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 車齡 */}
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>車齡</Text>
            <View style={s.filterRow}>
              {AGE_OPTIONS.map(a => (
                <TouchableOpacity
                  key={a.value}
                  style={[s.filterChip, filterAge === a.value && s.filterChipActive]}
                  onPress={() => setFilterAge(a.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterChipText, filterAge === a.value && s.filterChipTextActive]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 排序 */}
          <View style={s.filterSection}>
            <Text style={s.filterLabel}>排序方式</Text>
            <View style={s.filterRow}>
              {SORT_OPTIONS.map(so => (
                <TouchableOpacity
                  key={so.value}
                  style={[s.filterChip, filterSort === so.value && s.filterChipActive]}
                  onPress={() => setFilterSort(so.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.filterChipText, filterSort === so.value && s.filterChipTextActive]}>{so.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 底部按鈕 */}
          <View style={s.filterBtns}>
            <TouchableOpacity style={s.resetBtn} onPress={resetFilter} activeOpacity={0.7}>
              <Text style={s.resetBtnText}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={applyFilter} activeOpacity={0.8}>
              <Text style={s.applyBtnText}>查看結果</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 10, paddingHorizontal: 16,
    backgroundColor: '#f2f2f7',
  },
  backBtn: { width: 36, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  backArrow: { fontSize: 32, color: APP_TEXT, lineHeight: 36, marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT },

  // Tabs
  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabBtn: {
    flex: 1, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtnActive: {
    backgroundColor: APP_ORANGE,
    shadowColor: APP_ORANGE, shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#3a3a3c' },
  tabBtnTextActive: { color: '#fff' },

  body: { flex: 1 },

  // 搜索框
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10, gap: 8,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchIcon: { fontSize: 16, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: APP_TEXT, paddingVertical: 0 },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 14, color: APP_GRAY },
  cancelBtn: { paddingHorizontal: 4 },
  cancelBtnText: { fontSize: 15, color: APP_ORANGE, fontWeight: '500' },

  // Section
  section: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.3, marginBottom: 10 },
  sectionSub: { fontSize: 12, color: '#8e8e93' },
  clearHistoryBtn: { fontSize: 13, color: APP_ORANGE },

  // 熱門標籤
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hotTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  hotTagTop: { backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  hotRank: { fontSize: 12, fontWeight: '700', color: APP_ORANGE, marginRight: 4 },
  hotTagText: { fontSize: 14, color: APP_TEXT, fontWeight: '500' },
  hotTagTextTop: { color: APP_ORANGE, fontWeight: '600' },

  // 歷史標籤
  historyTag: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 0.5, borderColor: APP_BORDER,
  },
  historyTagText: { fontSize: 14, color: APP_TEXT },

  // 品牌列表
  brandList: {
    backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, paddingHorizontal: 16 },
  brandRowBorder: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandPin: { fontSize: 15 },
  brandName: { fontSize: 15, color: APP_TEXT, fontWeight: '500' },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandCount: { fontSize: 13, color: '#8e8e93' },
  brandArrow: { fontSize: 20, color: '#c7c7cc', lineHeight: 22 },

  // AI 搜索
  aiSearchBtn: {
    height: 48, borderRadius: 24,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8,
    shadowColor: APP_ORANGE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4, marginBottom: 16,
  },
  aiSearchBtnDisabled: { backgroundColor: '#e5e5ea', shadowOpacity: 0, elevation: 0 },
  aiSearchBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  aiResultCard: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(249,115,22,0.05)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 14, padding: 16,
  },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiResultIcon: { fontSize: 18 },
  aiResultTitle: { fontSize: 14, fontWeight: '700', color: APP_TEXT },
  aiResultSummary: { fontSize: 13, color: '#3a3a3c', lineHeight: 20, marginBottom: 12 },
  aiTagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  aiTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  aiTagText: { fontSize: 11, fontWeight: '600' },
  applyAIBtn: {
    height: 44, borderRadius: 22, backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  applyAIBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  aiHintBox: {
    marginHorizontal: 16, backgroundColor: '#fff',
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  aiHintTitle: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  aiHintItem: { paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)' },
  aiHintItemText: { fontSize: 14, color: '#3a3a3c' },

  // 篩選 Tab
  filterSection: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  filterLabel: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f2f2f7', borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: APP_ORANGE },
  filterChipText: { fontSize: 14, color: '#3a3a3c', fontWeight: '500' },
  filterChipTextActive: { color: APP_ORANGE, fontWeight: '600' },

  filterBtns: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  resetBtn: {
    flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: APP_BORDER,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  resetBtnText: { fontSize: 16, fontWeight: '600', color: APP_TEXT },
  applyBtn: {
    flex: 2, height: 48, borderRadius: 24, backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: APP_ORANGE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  applyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // 語音輸入樣式
  micBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f2f7',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  micBtnActive: { backgroundColor: 'rgba(239,68,68,0.15)' },
  micIcon: { fontSize: 20 },
  micIconActive: { color: '#EF4444' },
  recordingHint: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 6,
  },
  recordingDot: { fontSize: 12, color: '#EF4444' },
  recordingText: { fontSize: 13, color: APP_GRAY },
});
