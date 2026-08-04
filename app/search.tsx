/**
 * 搜索篩選頁
 * 智能搜索：微信式「按住說話，鬆開傳送」交互
 * Base64 修復：getURI() 必須在 stopAndUnloadAsync() 之前調用
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Keyboard, Animated, Easing,
  PanResponder, Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { trpc } from '../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../constants/data';

const HISTORY_KEY = 'gogocar_search_history';
type TabKey = 'search' | 'ai' | 'filter';

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

  // ── 搜索 Tab ──
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  // ── 智能搜索 Tab ──
  // 狀態：idle → pressing（按住中）→ processing（識別+分析中）→ result / cancelled
  type AiPhase = 'idle' | 'pressing' | 'processing' | 'result';
  const [aiPhase, setAiPhase] = useState<AiPhase>('idle');
  const [isCancelling, setIsCancelling] = useState(false); // 滑到取消區域
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiResult, setAiResult] = useState<{ summary: string; filters: Record<string, any> } | null>(null);
  const [aiTextInput, setAiTextInput] = useState('');
  const [processingMsg, setProcessingMsg] = useState('正在識別語音…');

  // 錄音動畫
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const waveAnims = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.6),
    new Animated.Value(0.8),
    new Animated.Value(0.5),
    new Animated.Value(0.7),
  ]).current;

  // ── 篩選 Tab ──
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
      setProcessingMsg('智能分析中…');
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

  const doSearch = useCallback((kw: string) => {
    if (!kw.trim()) return;
    saveHistory(kw.trim());
    Keyboard.dismiss();
    router.push(`/(tabs)/buy?search=${encodeURIComponent(kw.trim())}` as any);
  }, [saveHistory, router]);

  // ── 錄音相關 ──
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingUriRef = useRef<string | null>(null); // 關鍵：提前保存 URI

  const startWaveAnim = () => {
    waveAnims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 300 + i * 80,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300 + i * 80,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
  };

  const stopWaveAnim = () => {
    waveAnims.forEach(anim => {
      anim.stopAnimation();
      anim.setValue(0.4);
    });
  };

  // 按下麥克風 → 開始錄音
  const handlePressIn = async () => {
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
      recordingUriRef.current = null;
      setAiPhase('pressing');
      setIsCancelling(false);
      setAiResult(null);
      setAiTranscript('');
      Vibration.vibrate(30); // 輕震動反饋
      startWaveAnim();
    } catch (err) {
      Alert.alert('錄音失敗', '無法啟動麥克風，請檢查權限');
    }
  };

  // 鬆開 → 停止錄音並傳送
  const handlePressOut = async (cancelled: boolean = false) => {
    if (!recordingRef.current) return;
    stopWaveAnim();

    const rec = recordingRef.current;
    recordingRef.current = null;

    if (cancelled) {
      // 取消：靜默停止，不傳送
      setAiPhase('idle');
      setIsCancelling(false);
      try {
        await rec.stopAndUnloadAsync();
      } catch (_) {}
      Vibration.vibrate(50);
      return;
    }

    setAiPhase('processing');
    setProcessingMsg('正在識別語音…');

    try {
      // ✅ 關鍵修復：必須在 stopAndUnloadAsync() 之前調用 getURI()
      // iOS 上 _uri 在 prepareToRecordAsync 時設置，stop 後不變
      // 但 stop 後 _canRecord=false，getURI() 仍返回 _uri
      const uri = rec.getURI();

      // 停止錄音
      await rec.stopAndUnloadAsync();

      if (!uri) {
        throw new Error('錄音文件路徑為空，請重試');
      }

      // 確認文件存在
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('錄音文件不存在，請重試');
      }

      // 讀取 Base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length < 100) {
        throw new Error('錄音內容太短，請重試');
      }

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

  // PanResponder：處理按住+滑動取消
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        handlePressIn();
      },
      onPanResponderMove: (_, gestureState) => {
        // 向上滑超過 60px → 進入取消模式
        const cancelling = gestureState.dy < -60;
        setIsCancelling(cancelling);
      },
      onPanResponderRelease: (_, gestureState) => {
        const cancelled = gestureState.dy < -60;
        handlePressOut(cancelled);
      },
      onPanResponderTerminate: () => {
        handlePressOut(true);
      },
    })
  ).current;

  // 文字輸入觸發智能分析
  const doTextAiSearch = () => {
    const q = aiTextInput.trim();
    if (!q) return;
    Keyboard.dismiss();
    setAiTranscript(q);
    setAiResult(null);
    setAiPhase('processing');
    setProcessingMsg('智能分析中…');
    semanticMutation.mutate({ query: q });
  };

  // 套用智能篩選結果
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

  const resetAiSearch = () => {
    setAiPhase('idle');
    setAiTranscript('');
    setAiTextInput('');
    setAiResult(null);
    setIsCancelling(false);
  };

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

  return (
    <View style={s.root}>
      {/* 頂部 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>搜索篩選</Text>
      </View>

      {/* Tab 切換 */}
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
        <View style={{ flex: 1 }}>
          {/* ── idle：主界面 ── */}
          {(aiPhase === 'idle') && (
            <ScrollView
              style={s.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
            >
              {/* 文字輸入 */}
              <View style={[s.searchRow, { paddingTop: 8 }]}>
                <View style={s.searchBox}>
                  <Text style={s.searchIcon}>✨</Text>
                  <TextInput
                    style={s.searchInput}
                    placeholder="描述你想要的車，例：預算 30 萬..."
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
                  <TouchableOpacity style={s.aiSendBtn} onPress={doTextAiSearch} activeOpacity={0.8}>
                    <Text style={s.aiSendBtnText}>搜索</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 示例 */}
              <View style={s.aiExamplesBox}>
                <Text style={s.aiExamplesTitle}>💡 智能搜索示例</Text>
                {AI_EXAMPLES.map(ex => (
                  <TouchableOpacity
                    key={ex}
                    style={s.aiExampleItem}
                    onPress={() => setAiTextInput(ex)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.aiExampleArrow}>→</Text>
                    <Text style={s.aiExampleText}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── result：分析結果 ── */}
          {aiPhase === 'result' && aiResult && (
            <ScrollView style={s.body} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {aiTranscript ? (
                <View style={s.aiTranscriptBox}>
                  <Text style={s.aiTranscriptLabel}>你說的是：</Text>
                  <Text style={s.aiTranscriptText}>「{aiTranscript}」</Text>
                </View>
              ) : null}
              <View style={s.aiResultCard}>
                <View style={s.aiResultHeader}>
                  <Text style={s.aiResultIcon}>✅</Text>
                  <Text style={s.aiResultTitle}>智能分析完成</Text>
                </View>
                <Text style={s.aiResultSummary}>{aiResult.summary}</Text>
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
              <TouchableOpacity style={s.retryBtn} onPress={resetAiSearch} activeOpacity={0.7}>
                <Text style={s.retryBtnText}>🎙️ 重新搜索</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── processing：識別/分析中 ── */}
          {aiPhase === 'processing' && (
            <View style={s.aiProcessingArea}>
              {aiTranscript ? (
                <View style={s.aiTranscriptBox}>
                  <Text style={s.aiTranscriptLabel}>已識別：</Text>
                  <Text style={s.aiTranscriptText}>「{aiTranscript}」</Text>
                </View>
              ) : null}
              <ActivityIndicator size="large" color={APP_ORANGE} style={{ marginBottom: 16 }} />
              <Text style={s.aiProcessingText}>{processingMsg}</Text>
            </View>
          )}

          {/* ── 底部麥克風按鈕（微信式）── 始終顯示在 idle/pressing 狀態 */}
          {(aiPhase === 'idle' || aiPhase === 'pressing') && (
            <View style={s.micBarArea}>
              {/* 錄音中：波形 + 取消提示 */}
              {aiPhase === 'pressing' && (
                <View style={s.waveArea}>
                  {isCancelling ? (
                    <Text style={s.cancelHint}>鬆開取消</Text>
                  ) : (
                    <>
                      <View style={s.waveRow}>
                        {waveAnims.map((anim, i) => (
                          <Animated.View
                            key={i}
                            style={[
                              s.waveBar,
                              { transform: [{ scaleY: anim }] },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={s.waveHint}>上滑取消</Text>
                    </>
                  )}
                </View>
              )}

              {/* 按住說話按鈕 */}
              <View
                style={[
                  s.micBar,
                  aiPhase === 'pressing' && (isCancelling ? s.micBarCancelling : s.micBarActive),
                ]}
                {...panResponder.panHandlers}
              >
                <Text style={[s.micBarIcon, aiPhase === 'pressing' && s.micBarIconActive]}>
                  {aiPhase === 'pressing' ? '🎙️' : '🎙️'}
                </Text>
                <Text style={[s.micBarText, aiPhase === 'pressing' && s.micBarTextActive]}>
                  {aiPhase === 'pressing'
                    ? (isCancelling ? '鬆開取消' : '正在錄音…鬆開傳送')
                    : '按住 說話'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ===== 篩選 Tab ===== */}
      {tab === 'filter' && (
        <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f2f7' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 10, paddingHorizontal: 16,
    backgroundColor: '#f2f2f7',
  },
  backBtn: { width: 36, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  backArrow: { fontSize: 32, color: APP_TEXT, lineHeight: 36, marginTop: -4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT },

  tabRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12,
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
  historyTag: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 0.5, borderColor: APP_BORDER,
  },
  historyTagText: { fontSize: 14, color: APP_TEXT },

  brandList: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
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

  // 智能搜索 — 文字發送按鈕
  aiSendBtn: {
    height: 44, paddingHorizontal: 16, borderRadius: 22,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  aiSendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // 示例
  aiExamplesBox: {
    marginHorizontal: 16, marginTop: 4,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  aiExamplesTitle: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  aiExampleItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  aiExampleArrow: { fontSize: 16, color: APP_ORANGE, fontWeight: '700' },
  aiExampleText: { fontSize: 14, color: '#3a3a3c', flex: 1 },

  // 識別文字回顯
  aiTranscriptBox: {
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
  },
  aiTranscriptLabel: { fontSize: 12, color: APP_ORANGE, fontWeight: '600', marginTop: 1 },
  aiTranscriptText: { fontSize: 14, color: APP_TEXT, flex: 1, lineHeight: 20 },

  // 處理中
  aiProcessingArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  aiProcessingText: { fontSize: 16, fontWeight: '600', color: APP_TEXT },

  // 結果卡片
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
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: APP_ORANGE },

  // ── 微信式底部麥克風欄 ──
  micBarArea: {
    paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8,
    backgroundColor: '#f2f2f7',
  },
  waveArea: {
    alignItems: 'center', marginBottom: 12, height: 50, justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, height: 40,
  },
  waveBar: {
    width: 4, height: 36, borderRadius: 2, backgroundColor: APP_ORANGE,
  },
  waveHint: { fontSize: 12, color: APP_GRAY, marginTop: 4 },
  cancelHint: { fontSize: 16, fontWeight: '700', color: '#EF4444' },

  micBar: {
    height: 54, borderRadius: 27,
    backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: APP_BORDER,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  micBarActive: {
    backgroundColor: APP_ORANGE,
    borderColor: APP_ORANGE,
    shadowColor: APP_ORANGE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  micBarCancelling: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  micBarIcon: { fontSize: 22 },
  micBarIconActive: { fontSize: 24 },
  micBarText: { fontSize: 17, fontWeight: '600', color: APP_TEXT },
  micBarTextActive: { color: '#fff' },

  // 篩選
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
