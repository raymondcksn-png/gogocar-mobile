/**
 * 搜索篩選頁 — 對齊 WebApp /app/search
 * 三 Tab：搜索 / 智能搜索 / 篩選
 * 智能搜索：語音為主入口（大廠標準），文字輔助，直接跳車源列表
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Keyboard, Animated, Easing,
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

// 智能搜索示例
const AI_EXAMPLES = [
  '預算 30 萬以內的日系 SUV',
  '低里程自動波電動車',
  '5 年內寶馬 3 系，預算 50 萬',
  '七人座 MPV，適合家庭用',
  '澳門本地車，10 萬以下代步車',
];

export default function SearchScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('search');

  // ── 搜索 Tab state ──
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ── 智能搜索 Tab state ──
  // 三個階段：idle → recording → transcribing → analyzing → result
  type AiPhase = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'result';
  const [aiPhase, setAiPhase] = useState<AiPhase>('idle');
  const [aiTranscript, setAiTranscript] = useState(''); // 語音識別出的文字
  const [aiResult, setAiResult] = useState<{ summary: string; filters: Record<string, any> } | null>(null);
  const [aiTextInput, setAiTextInput] = useState(''); // 文字輸入備用

  // 錄音動畫
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

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
      setAiPhase('result');
    },
    onError: (err: any) => {
      setAiPhase('idle');
      Alert.alert('智能分析失敗', err.message || '請重試');
    },
  });

  const voiceMutation = trpc.voice.transcribe.useMutation({
    onSuccess: (data: any) => {
      const text = data.text?.trim() || '';
      if (!text) {
        setAiPhase('idle');
        Alert.alert('未能識別語音', '請重試或使用文字輸入');
        return;
      }
      setAiTranscript(text);
      setAiTextInput(text);
      // 直接進入分析階段
      setAiPhase('analyzing');
      semanticMutation.mutate({ query: text });
    },
    onError: (err: any) => {
      setAiPhase('idle');
      Alert.alert('語音識別失敗', err.message || '請重試');
    },
  });

  const hotList: { keyword: string; rank: number }[] = hotData || [];
  const brandList: { brandName: string; modelCount: number }[] = (brandStatsData || [])
    .filter((b: any) => b.brandName)
    .sort((a: any, b: any) => Number(b.modelCount) - Number(a.modelCount));
  const totalModels = brandList.reduce((s, b) => s + Number(b.modelCount), 0);

  // ── 載入搜索歷史 ──
  useEffect(() => {
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

  // ── 錄音相關 ──
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  };

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
      setAiPhase('recording');
      setAiTranscript('');
      setAiResult(null);
      startPulse();
    } catch (err) {
      Alert.alert('錄音失敗', '無法啟動麥克風，請檢查權限');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setAiPhase('transcribing');
    try {
      // 關鍵修復：先取 URI，再 stop，再讀取文件
      const rec = recordingRef.current;
      recordingRef.current = null;

      // 先停止錄音
      await rec.stopAndUnloadAsync();

      // 停止後通過狀態獲取 URI（更可靠）
      const status = await rec.getStatusAsync().catch(() => null);
      let uri = (status as any)?.uri || rec.getURI();

      if (!uri) {
        // 最後嘗試：從 Audio.Recording 靜態方法獲取
        throw new Error('錄音文件路徑無法獲取，請重試');
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      voiceMutation.mutate({
        audioBase64: base64,
        filename: 'voice-search.m4a',
        contentType: 'audio/m4a',
      });
    } catch (err: any) {
      setAiPhase('idle');
      Alert.alert('語音處理失敗', err.message || '請重試');
    }
  };

  // ── 文字輸入觸發智能分析 ──
  const doTextAiSearch = () => {
    const q = aiTextInput.trim();
    if (!q) return;
    Keyboard.dismiss();
    setAiTranscript(q);
    setAiResult(null);
    setAiPhase('analyzing');
    semanticMutation.mutate({ query: q });
  };

  // ── 套用智能篩選結果 → 跳買車頁 ──
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

  // ── 重置智能搜索 ──
  const resetAiSearch = () => {
    setAiPhase('idle');
    setAiTranscript('');
    setAiTextInput('');
    setAiResult(null);
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
          const label = t === 'search' ? '🔍 搜索' : t === 'ai' ? '✨ 智能搜索' : '⚙️ 篩選';
          return (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => { setTab(t); if (t !== 'ai') resetAiSearch(); }}
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

      {/* ===== 智能搜索 Tab ===== */}
      {tab === 'ai' && (
        <ScrollView
          style={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ── 階段：idle（初始狀態）── */}
          {aiPhase === 'idle' && (
            <>
              {/* 大麥克風按鈕 — 主入口 */}
              <View style={s.aiHeroArea}>
                <Text style={s.aiHeroTitle}>說出你想找的車</Text>
                <Text style={s.aiHeroSub}>支援廣東話 · 普通話 · 英語 · 葡語</Text>

                <TouchableOpacity
                  style={s.micHeroBtn}
                  onPress={startRecording}
                  activeOpacity={0.85}
                >
                  <Text style={s.micHeroIcon}>🎙️</Text>
                  <Text style={s.micHeroBtnText}>按下開始說話</Text>
                </TouchableOpacity>

                <Text style={s.aiOrText}>— 或者文字輸入 —</Text>

                {/* 文字輸入備用 */}
                <View style={s.aiTextRow}>
                  <View style={s.aiTextBox}>
                    <Text style={s.aiTextBoxIcon}>✨</Text>
                    <TextInput
                      style={s.aiTextInput}
                      placeholder="描述你想要的車..."
                      placeholderTextColor={APP_GRAY}
                      value={aiTextInput}
                      onChangeText={setAiTextInput}
                      returnKeyType="search"
                      onSubmitEditing={doTextAiSearch}
                    />
                    {aiTextInput.length > 0 && (
                      <TouchableOpacity onPress={() => setAiTextInput('')} style={s.clearBtn}>
                        <Text style={s.clearBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {aiTextInput.trim().length > 0 && (
                    <TouchableOpacity style={s.aiTextSendBtn} onPress={doTextAiSearch} activeOpacity={0.8}>
                      <Text style={s.aiTextSendIcon}>→</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* 示例提示 */}
              <View style={s.aiExamplesBox}>
                <Text style={s.aiExamplesTitle}>💡 試試這樣說</Text>
                {AI_EXAMPLES.map(ex => (
                  <TouchableOpacity
                    key={ex}
                    style={s.aiExampleItem}
                    onPress={() => { setAiTextInput(ex); }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.aiExampleArrow}>›</Text>
                    <Text style={s.aiExampleText}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── 階段：recording（錄音中）── */}
          {aiPhase === 'recording' && (
            <View style={s.aiActiveArea}>
              <Text style={s.aiActiveTitle}>正在聆聽…</Text>
              <Text style={s.aiActiveSub}>請說出你想找的車</Text>

              {/* 動畫麥克風 */}
              <Animated.View style={[s.micPulseOuter, { transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity style={s.micPulseBtn} onPress={stopRecording} activeOpacity={0.85}>
                  <Text style={s.micPulseIcon}>🎙️</Text>
                </TouchableOpacity>
              </Animated.View>

              <Text style={s.aiActiveHint}>點擊停止錄音</Text>
              <Text style={s.aiActiveLang}>廣東話 · 普通話 · 英語 · 葡語</Text>
            </View>
          )}

          {/* ── 階段：transcribing（語音識別中）── */}
          {aiPhase === 'transcribing' && (
            <View style={s.aiActiveArea}>
              <ActivityIndicator size="large" color={APP_ORANGE} style={{ marginBottom: 16 }} />
              <Text style={s.aiActiveTitle}>正在識別語音…</Text>
              <Text style={s.aiActiveSub}>請稍候</Text>
            </View>
          )}

          {/* ── 階段：analyzing（智能分析中）── */}
          {aiPhase === 'analyzing' && (
            <View style={s.aiActiveArea}>
              {aiTranscript ? (
                <View style={s.aiTranscriptBox}>
                  <Text style={s.aiTranscriptLabel}>已識別：</Text>
                  <Text style={s.aiTranscriptText}>「{aiTranscript}」</Text>
                </View>
              ) : null}
              <ActivityIndicator size="large" color={APP_ORANGE} style={{ marginBottom: 16 }} />
              <Text style={s.aiActiveTitle}>智能分析中…</Text>
              <Text style={s.aiActiveSub}>正在為你匹配最合適的車源</Text>
            </View>
          )}

          {/* ── 階段：result（分析完成）── */}
          {aiPhase === 'result' && aiResult && (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {/* 識別文字回顯 */}
              {aiTranscript ? (
                <View style={s.aiTranscriptBox}>
                  <Text style={s.aiTranscriptLabel}>你說的是：</Text>
                  <Text style={s.aiTranscriptText}>「{aiTranscript}」</Text>
                </View>
              ) : null}

              {/* 分析結果卡片 */}
              <View style={s.aiResultCard}>
                <View style={s.aiResultHeader}>
                  <Text style={s.aiResultIcon}>✅</Text>
                  <Text style={s.aiResultTitle}>智能分析完成</Text>
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

                {/* 查看車源按鈕 */}
                <TouchableOpacity style={s.applyAIBtn} onPress={applyAIFilters} activeOpacity={0.8}>
                  <Text style={s.applyAIBtnText}>查看符合條件的車源 →</Text>
                </TouchableOpacity>
              </View>

              {/* 重新搜索 */}
              <TouchableOpacity style={s.retryBtn} onPress={resetAiSearch} activeOpacity={0.7}>
                <Text style={s.retryBtnText}>🎙️ 重新搜索</Text>
              </TouchableOpacity>
            </View>
          )}
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

  // ── 智能搜索：Hero 區域（idle 狀態）──
  aiHeroArea: {
    alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 8,
  },
  aiHeroTitle: {
    fontSize: 22, fontWeight: '700', color: APP_TEXT, marginBottom: 6,
  },
  aiHeroSub: {
    fontSize: 13, color: APP_GRAY, marginBottom: 32,
  },

  // 大麥克風按鈕
  micHeroBtn: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: APP_ORANGE, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 8, marginBottom: 28,
  },
  micHeroIcon: { fontSize: 44, marginBottom: 4 },
  micHeroBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  aiOrText: {
    fontSize: 13, color: '#c7c7cc', marginBottom: 16,
  },

  // 文字輸入備用
  aiTextRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
  },
  aiTextBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  aiTextBoxIcon: { fontSize: 16, marginRight: 6 },
  aiTextInput: { flex: 1, fontSize: 15, color: APP_TEXT, paddingVertical: 0 },
  aiTextSendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: APP_ORANGE, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  aiTextSendIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },

  // 示例
  aiExamplesBox: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  aiExamplesTitle: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  aiExampleItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  aiExampleArrow: { fontSize: 18, color: APP_ORANGE, fontWeight: '700', lineHeight: 22 },
  aiExampleText: { fontSize: 14, color: '#3a3a3c', flex: 1 },

  // ── 智能搜索：Active 區域（recording/transcribing/analyzing）──
  aiActiveArea: {
    alignItems: 'center', paddingTop: 60, paddingHorizontal: 24,
  },
  aiActiveTitle: {
    fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 8,
  },
  aiActiveSub: {
    fontSize: 14, color: APP_GRAY, marginBottom: 40,
  },
  aiActiveHint: {
    fontSize: 13, color: APP_GRAY, marginTop: 24,
  },
  aiActiveLang: {
    fontSize: 12, color: '#c7c7cc', marginTop: 8,
  },

  // 動畫麥克風
  micPulseOuter: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(249,115,22,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  micPulseBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: APP_ORANGE, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  micPulseIcon: { fontSize: 44 },

  // 語音識別文字回顯
  aiTranscriptBox: {
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20, width: '100%',
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
  },
  aiTranscriptLabel: { fontSize: 12, color: APP_ORANGE, fontWeight: '600', marginTop: 1 },
  aiTranscriptText: { fontSize: 14, color: APP_TEXT, flex: 1, lineHeight: 20 },

  // ── 智能搜索：Result 區域 ──
  aiResultCard: {
    backgroundColor: 'rgba(249,115,22,0.05)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiResultIcon: { fontSize: 18 },
  aiResultTitle: { fontSize: 14, fontWeight: '700', color: APP_TEXT },
  aiResultSummary: { fontSize: 13, color: '#3a3a3c', lineHeight: 20, marginBottom: 12 },
  aiTagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  aiTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  aiTagText: { fontSize: 11, fontWeight: '600' },
  applyAIBtn: {
    height: 48, borderRadius: 24, backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: APP_ORANGE, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  applyAIBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  retryBtn: {
    height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: APP_ORANGE },

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
});
