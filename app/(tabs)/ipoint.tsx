/**
 * iPoint 積分頁 — 完整對齊 WebApp AppIpointBalance + AppIpointRecharge
 * 功能：餘額卡片 / 待審核訂單 / 交易記錄篩選 / 充值（離線多步驟 + 微信即將開通）
 * API: ipoint.getBalance / ipoint.myTransactions / payment.listMethods / payment.createOrder / payment.uploadReceipt
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Image,
  KeyboardAvoidingView, Platform, AppState,
  RefreshControl,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { trpc, API_BASE_URL, resolveImageUrl } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// ── 常量 ──────────────────────────────────────────────────────────────────
// 默認套餐（後台未返回時使用）
const DEFAULT_PACKAGES = [
  { ipoint: 50,   bonus: 0 },
  { ipoint: 100,  bonus: 0 },
  { ipoint: 200,  bonus: 0 },
  { ipoint: 500,  bonus: 20 },
  { ipoint: 1000, bonus: 50 },
  { ipoint: 2000, bonus: 150 },
];

const TX_TYPE_TABS = [
  { key: undefined, label: '全部' },
  { key: 'recharge', label: '充值' },
  { key: 'task_reward', label: '任務獎勵' },
  { key: 'publish_fee', label: '發佈扣費' },
  { key: 'refund', label: '退款' },
  { key: 'admin_adjust', label: '調整' },
] as const;

const TX_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  recharge:     { label: '充值',       color: '#22C55E', icon: '↓' },
  task_reward:  { label: '任務獎勵',   color: '#8B5CF6', icon: '🎁' },
  publish_fee:  { label: '發佈扣費',   color: '#EF4444', icon: '↑' },
  refund:       { label: '退款',       color: '#3B82F6', icon: '↩' },
  admin_adjust: { label: '管理員調整', color: '#6B7280', icon: '⚙' },
};

const METHOD_TYPE_LABEL: Record<string, string> = {
  bank_transfer: '銀行轉帳',
  mpay:          'MPay',
  qr_scan:       '二維碼收款',
  fps:           'FPS 轉數快',
  'FPS轉數快':   'FPS 轉數快',
  other:         '其他',
};

const METHOD_TYPE_ICON: Record<string, string> = {
  bank_transfer: '🏦',
  mpay:          '📱',
  qr_scan:       '📷',
  fps:           '⚡',
  'FPS轉數快':   '⚡',
  other:         '💳',
};

// ── 主組件 ────────────────────────────────────────────────────────────────
type Screen = 'main' | 'recharge-step1' | 'recharge-detail' | 'recharge-proof' | 'recharge-success' | 'alipay-pending';

export default function IPointScreen() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();

  const [screen, setScreen] = useState<Screen>('main');
  const [txFilterType, setTxFilterType] = useState<string | undefined>(undefined);

  // 充值流程狀態
  const [selectedIPoint, setSelectedIPoint] = useState<number>(100);
  const [customIPoint, setCustomIPoint] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [remark, setRemark] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alipayPolling, setAlipayPolling] = useState(false);
  const alipayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 財務敗感查詢：staleTime:0 保證每次進入頁面都重新請求，不使用快取
  const { data: balanceData, refetch: refetchBalance } = trpc.ipoint.getBalance.useQuery(
    undefined, { enabled: isLoggedIn, staleTime: 0, refetchOnMount: 'always' }
  );
  const { data: txData, refetch: refetchTx } = trpc.ipoint.myTransactions.useQuery(
    txFilterType ? { type: txFilterType as any } : undefined,
    { enabled: isLoggedIn, staleTime: 0, refetchOnMount: 'always' }
  );
  const { data: pendingOrders, refetch: refetchOrders } = trpc.payment.myOrders.useQuery(
    undefined, { enabled: isLoggedIn, staleTime: 0, refetchOnMount: 'always' }
  );
  const { data: methods, isLoading: methodsLoading } = trpc.payment.listMethods.useQuery();

  // APP 從後台切回前台時自動刷新（大廠標準：財務數據必須即時更新）
  const appStateRef = useRef(AppState.currentState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchBalance(), refetchTx(), refetchOrders()]);
    setIsRefreshing(false);
  }, [refetchBalance, refetchTx, refetchOrders]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active' && isLoggedIn) {
        refetchBalance();
        refetchTx();
        refetchOrders();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [isLoggedIn, refetchBalance, refetchTx, refetchOrders]);

  const createOrderMut = trpc.payment.createOrder.useMutation();
  const uploadReceiptMut = trpc.payment.uploadReceipt.useMutation();
  const createAlipayOrderMut = trpc.payment.createAlipayOrder.useMutation();
  const utils = trpc.useUtils();

  // 獲取匯率（用於顯示 RMB 等值）
  const { data: rateData } = trpc.wechatPay.getExchangeRate.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const mopToCny = rateData?.rate ?? 0.88;
  const mopToHkd = (rateData as any)?.hkdRate ?? 0.97;
  // 從後台讀取套餐配置（動態）
  const packages = (rateData as any)?.packages ?? DEFAULT_PACKAGES;

  // ── 根據用戶手機號前綴判斷地域 ──────────────────────────────────────────
  // +853 澳門 | +852 香港 | +86 大陸 | 其他默認澳門
  const userRegion = (() => {
    const phone = user?.phone ?? '';
    if (phone.startsWith('+852') || phone.startsWith('852')) return 'hk';
    if (phone.startsWith('+86') || phone.startsWith('86')) return 'cn';
    return 'mo'; // 默認澳門（+853 或未知）
  })();
  const regionCurrencyLabel = { mo: 'MOP', hk: 'HKD', cn: 'RMB' }[userRegion];

  // 最終 iPoint 數量
  const finalIPoint = customIPoint ? Math.max(1, parseInt(customIPoint) || 1) : selectedIPoint;
  // 對應 MOP 金額（1 iP = 1 MOP）
  const mopAmount = finalIPoint;
  // 對應 RMB 金額（動態匯率換算）
  const cnyAmount = Math.max(0.01, Math.round(mopAmount * mopToCny * 100) / 100);
  // 對應 HKD 金額
  const hkdAmount = Math.round(mopAmount * mopToHkd * 100) / 100;
  // 主幣種顯示金額（根據地域）
  const primaryAmount = userRegion === 'hk' ? hkdAmount : userRegion === 'cn' ? cnyAmount : mopAmount;
  const primaryCurrency = regionCurrencyLabel;

  // ── 支付寶 App 支付 ──
  const handleAlipayPay = async () => {
    if (!finalIPoint || finalIPoint < 1) { Alert.alert('提示', '請選擇充值 iPoint 數量'); return; }
    setSubmitting(true);
    try {
      const result = await createAlipayOrderMut.mutateAsync({
        ipointAmount: finalIPoint,
      });
      setOrderNo(result.orderNo);
      const alipayScheme = Platform.OS === 'ios' ? 'alipays://' : 'alipayqr://';
      const canOpen = await Linking.canOpenURL(alipayScheme);
      if (canOpen) {
        await Linking.openURL(`${alipayScheme}platformapi/startapp?saId=10000007&qrcode=${encodeURIComponent(result.orderString)}`);
      } else {
        Alert.alert('提示', '請先安裝支付寶 APP 才能使用此支付方式');
        setSubmitting(false);
        return;
      }
      setScreen('alipay-pending');
      let count = 0;
      alipayPollRef.current = setInterval(async () => {
        count++;
        if (count > 100) { clearInterval(alipayPollRef.current!); setAlipayPolling(false); return; }
        try {
          const res = await utils.payment.queryAlipayOrder.fetch({ orderNo: result.orderNo });
          if (res?.status === 'TRADE_SUCCESS') {
            clearInterval(alipayPollRef.current!);
            setAlipayPolling(false);
            refetchBalance(); refetchTx(); refetchOrders();
            setScreen('recharge-success');
          }
        } catch {}
      }, 3000);
      setAlipayPolling(true);
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '創建支付寶訂單失敗');
    }
    setSubmitting(false);
  };



  const handleOfflineNext = async () => {
    if (!selectedMethod) { Alert.alert('提示', '請選擇支付方式'); return; }
    if (!finalIPoint || finalIPoint < 1) { Alert.alert('提示', '請選擇充值 iPoint 數量'); return; }
    setSubmitting(true);
    try {
      const result = await createOrderMut.mutateAsync({
        methodId: selectedMethod.id,
        amount: mopAmount,
        remark: remark || undefined,
      });
      setOrderNo(result.orderNo);
      setScreen('recharge-detail');
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '創建訂單失敗');
    }
    setSubmitting(false);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('提示', '需要相冊權限才能上傳憑證'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const handleSubmitProof = async () => {
    if (!receiptUri) { Alert.alert('提示', '請上傳轉帳截圖'); return; }
    setSubmitting(true);
    try {
      // 雙軌兼容上傳：使用 fetch + FormData（比 FileSystem.uploadAsync 更可靠，支持 iOS HEIC/HEIF 等所有格式）
      // 後端返回相對路徑（/manus-storage/... 或 /uploads/...）
      // 後台 WebApp 瀏覽器自動補全為絕對 URL，完全正確
      let receiptUrl: string | null = null;
      try {
        // 從 URI 推斷 MIME 類型（iOS 截圖常為 HEIC，統一發送為 JPEG）
        const uriLower = receiptUri.toLowerCase();
        const mimeType = uriLower.includes('.png') ? 'image/png'
          : uriLower.includes('.gif') ? 'image/gif'
          : uriLower.includes('.webp') ? 'image/webp'
          : 'image/jpeg'; // 預設 JPEG（包括 HEIC/HEIF 統一發送為 JPEG）
        const filename = `receipt_${Date.now()}.jpg`;
        const formData = new FormData();
        formData.append('file', { uri: receiptUri, name: filename, type: mimeType } as any);
        const resp = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData,
          // 不要設 Content-Type，讓 fetch 自動設置 boundary
        });
        if (resp.ok) {
          const data = await resp.json();
          receiptUrl = data.url || null;
        } else {
          const errText = await resp.text().catch(() => '');
          console.warn('[Receipt Upload] Server error:', resp.status, errText);
        }
      } catch (uploadErr: any) {
        console.error('[Receipt Upload] Network error:', uploadErr);
      }
      if (!receiptUrl) {
        Alert.alert('上傳失敗', '圖片上傳失敗，請檢查網絡後重試。');
        setSubmitting(false);
        return;
      }
      await uploadReceiptMut.mutateAsync({ orderNo, receiptUrl });
      refetchBalance();
      refetchTx();
      refetchOrders();
      setScreen('recharge-success');
    } catch (e: any) {
      Alert.alert('錯誤', e.message || '提交失敗，請重試');
    }
    setSubmitting(false);
  };

  const resetRecharge = useCallback(() => {
    setScreen('main');
    setSelectedIPoint(100);
    setCustomIPoint('');
    setSelectedMethod(null);
    setRemark('');
    setOrderNo('');
    setReceiptUri(null);
    setSubmitting(false);
    if (alipayPollRef.current) { clearInterval(alipayPollRef.current); alipayPollRef.current = null; }
    setAlipayPolling(false);
  }, []);

  // ── 支付寶等待確認頁面 ──
  if (screen === 'alipay-pending') {
    return (
      <View style={s.container}>
        <View style={s.header}><Text style={s.headerTitle}>等待支付確認</Text></View>
        <View style={s.successWrap}>
          <View style={[s.successIcon, { backgroundColor: '#EFF6FF' }]}>
            <Text style={{ fontSize: 40 }}>💙</Text>
          </View>
          <Text style={s.successTitle}>等待支付寶確認</Text>
          <Text style={s.successSub}>請在支付寶 APP 完成付款{'\n'}完成後自動返回此頁面</Text>
          <View style={s.successCard}>
            <SRow label="訂單號" value={orderNo} mono />
            <SRow label="充值金額" value={`RMB ${cnyAmount}`} orange />
            <SRow label="iPoint" value={`${finalIPoint} iP`} />
            <SRow label="狀態" value={alipayPolling ? '等待支付中...' : '已超時'} amber />
          </View>
          {alipayPolling && <ActivityIndicator color={APP_ORANGE} style={{ marginBottom: 16 }} />}
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: '#3B82F6' }]} onPress={async () => {
            try {
              const res = await utils.payment.queryAlipayOrder.fetch({ orderNo });
              if (res?.status === 'TRADE_SUCCESS') {
                if (alipayPollRef.current) clearInterval(alipayPollRef.current);
                setAlipayPolling(false);
                refetchBalance(); refetchTx(); refetchOrders();
                setScreen('recharge-success');
              } else {
                Alert.alert('提示', '支付尚未完成，請在支付寶 APP 完成付款後再試');
              }
            } catch (e: any) { Alert.alert('查詢失敗', e.message); }
          }} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>我已完成付款</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={resetRecharge}>
            <Text style={{ fontSize: 14, color: APP_GRAY }}>取消支付</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={s.guestWrap}>
        <Text style={s.guestIcon}>💎</Text>
        <Text style={s.guestTitle}>登入後查看 iPoint</Text>
        <Text style={s.guestSub}>iPoint 可用於置頂車源、精選推廣等服務</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={s.loginBtnText}>立即登入</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── 充值成功 ──
  if (screen === 'recharge-success') {
    return (
      <View style={s.container}>
        <View style={s.header}><Text style={s.headerTitle}>充值 iPoint</Text></View>
        <View style={s.successWrap}>
          <View style={s.successIcon}><Text style={{ fontSize: 40 }}>✅</Text></View>
          <Text style={s.successTitle}>{orderNo.startsWith('ALI-') ? '支付成功！' : '憑證已提交'}</Text>
          <Text style={s.successSub}>{orderNo.startsWith('ALI-') ? 'iPoint 已即時到帳' : '工作時間（09:00–18:00）內審核並充值'}</Text>
          <View style={s.successCard}>
            <SRow label="訂單號" value={orderNo} mono />
            <SRow label="充值金額" value={`MOP ${mopAmount}`} orange />
            <SRow label="iPoint" value={`${finalIPoint} iP`} />
            <SRow label="狀態" value={orderNo.startsWith('ALI-') ? '支付成功' : '等待審核'} amber={!orderNo.startsWith('ALI-')} orange={orderNo.startsWith('ALI-')} />
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={resetRecharge}>
            <Text style={s.primaryBtnText}>返回 iPoint 頁面</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── 上傳憑證 ──
  if (screen === 'recharge-proof') {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setScreen('recharge-detail')} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>上傳憑證</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <Text style={s.formMeta}>訂單號：{orderNo}</Text>
          <Text style={s.formMeta}>充值：{finalIPoint} iPoint（MOP {mopAmount}）</Text>
          <View style={{ height: 16 }} />
          <Text style={s.fieldLabel}>上傳轉帳截圖</Text>
          <TouchableOpacity style={s.uploadBox} onPress={handlePickImage} activeOpacity={0.7}>
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={s.uploadPreview} resizeMode="contain" />
            ) : (
              <>
                <Text style={s.uploadIcon}>📷</Text>
                <Text style={s.uploadText}>點擊選擇圖片</Text>
                <Text style={s.uploadHint}>支持 JPG/PNG，最大 10MB</Text>
              </>
            )}
          </TouchableOpacity>
          {receiptUri && (
            <TouchableOpacity onPress={handlePickImage} style={s.rePickBtn}>
              <Text style={s.rePickText}>重新選擇</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.primaryBtn, (!receiptUri || submitting) && s.primaryBtnDisabled]}
            onPress={handleSubmitProof}
            disabled={!receiptUri || submitting}
            activeOpacity={0.8}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>提交憑證</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── 收款資料 ──
  if (screen === 'recharge-detail' && selectedMethod) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setScreen('recharge-step1')} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>收款資料</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent}>
          <View style={s.methodDetailCard}>
            <Text style={s.methodDetailIcon}>{METHOD_TYPE_ICON[selectedMethod.type] || '💳'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.methodDetailName}>{selectedMethod.name}</Text>
              <Text style={s.methodDetailType}>{METHOD_TYPE_LABEL[selectedMethod.type] || selectedMethod.type}</Text>
              <Text style={s.methodDetailAmount}>{finalIPoint} iPoint（MOP {mopAmount}）</Text>
            </View>
          </View>
          <View style={s.detailCard}>
            {selectedMethod.accountName && <DRow label="收款人" value={selectedMethod.accountName} />}
            {selectedMethod.bankName && <DRow label="銀行" value={selectedMethod.bankName} />}
            {selectedMethod.accountNumber && <DRow label="帳號" value={selectedMethod.accountNumber} />}
            {selectedMethod.phoneNumber && <DRow label="手機號" value={selectedMethod.phoneNumber} />}
            {selectedMethod.instructions && (
              <View style={{ paddingTop: 10 }}>
                <Text style={s.fieldLabel}>轉帳說明</Text>
                <Text style={{ fontSize: 13, color: APP_TEXT, lineHeight: 20 }}>{selectedMethod.instructions}</Text>
              </View>
            )}
          </View>
          {selectedMethod.qrCodeUrl && (
            <View style={s.qrWrap}>
              <Text style={s.fieldLabel}>掃碼收款</Text>
              <Image
                source={{ uri: resolveImageUrl(selectedMethod.qrCodeUrl) || selectedMethod.qrCodeUrl }}
                style={s.qrImage}
                resizeMode="contain"
              />
            </View>
          )}
          <Text style={s.fieldLabel}>轉帳備註（選填）</Text>
          <TextInput
            style={s.remarkInput}
            value={remark}
            onChangeText={setRemark}
            placeholder="如：GoGoCar 充值 MOP 100"
            placeholderTextColor={APP_GRAY}
          />
          <View style={s.tipBox}>
            <Text style={s.tipText}>💡 請按以上資料完成轉帳，然後點擊下一步上傳截圖憑證</Text>
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => setScreen('recharge-proof')} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>已轉帳，上傳憑證</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── 充值步驟 1 ──
  if (screen === 'recharge-step1') {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={resetRecharge} style={s.backBtn}>
            <Text style={s.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>充值 iPoint</Text>
        </View>
        <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>選擇充值套餐</Text>
          <View style={s.amountGrid}>
            {packages.map((pkg: any) => {
              const active = selectedIPoint === pkg.ipoint && !customIPoint;
              return (
                <TouchableOpacity
                  key={pkg.ipoint}
                  style={[s.amountBtn, active && s.amountBtnActive]}
                  onPress={() => { setSelectedIPoint(pkg.ipoint); setCustomIPoint(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.amountBtnText, active && s.amountBtnTextActive]}>{pkg.ipoint} iP</Text>
                  <Text style={{ fontSize: 11, color: active ? APP_ORANGE : APP_GRAY, marginTop: 2 }}>
                    {primaryCurrency} {userRegion === 'hk' ? Math.round(pkg.ipoint * mopToHkd * 100) / 100 : userRegion === 'cn' ? Math.round(pkg.ipoint * mopToCny * 100) / 100 : pkg.ipoint}
                  </Text>
                  {pkg.bonus > 0 ? <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700' }}>+{pkg.bonus} iP</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={s.customInput}
            value={customIPoint}
            onChangeText={setCustomIPoint}
            placeholder="自定義 iPoint 數量"
            placeholderTextColor={APP_GRAY}
            keyboardType="numeric"
          />
          {/* 幣值換算顯示 */}
          <View style={[s.ipointRow, { backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, marginTop: 8 }]}>
            <View>
              <Text style={s.ipointLabel}>充值 iPoint</Text>
              <Text style={[s.ipointValue, { fontSize: 18 }]}>{finalIPoint} iP</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.ipointLabel}>等值金額</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: APP_ORANGE }}>{primaryCurrency} {primaryAmount}</Text>
              {userRegion === 'mo' && <Text style={{ fontSize: 11, color: APP_GRAY }}>≈ RMB {cnyAmount}（支付寶）</Text>}
              {userRegion === 'hk' && <Text style={{ fontSize: 11, color: APP_GRAY }}>≈ MOP {mopAmount} / RMB {cnyAmount}（支付寶）</Text>}
              {userRegion === 'cn' && <Text style={{ fontSize: 11, color: APP_GRAY }}>≈ MOP {mopAmount}</Text>}
            </View>
          </View>

          <Text style={[s.sectionLabel, { marginTop: 20 }]}>選擇支付方式</Text>
          {methodsLoading ? (
            <ActivityIndicator color={APP_ORANGE} style={{ paddingVertical: 16 }} />
          ) : methods && (methods as any[]).length > 0 ? (
            <View style={s.methodList}>
              {(methods as any[]).map((m: any) => {
                const isSelected = selectedMethod?.id === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.methodItem, isSelected && s.methodItemActive]}
                    onPress={() => setSelectedMethod(m)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.methodIcon}>{METHOD_TYPE_ICON[m.type] || '💳'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.methodName, isSelected && s.methodNameActive]}>{m.name}</Text>
                      <Text style={s.methodType}>{METHOD_TYPE_LABEL[m.type] || m.type}</Text>
                    </View>
                    {isSelected && <Text style={{ color: APP_ORANGE, fontSize: 18 }}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={s.noMethodBox}>
              <Text style={s.noMethodText}>暫無可用支付方式，請聯繫客服</Text>
            </View>
          )}

          <View style={s.methodItemDisabled}>
            {/* 支付寶 — 已上線，排在微信前面 */}
            <View style={{ borderRadius: 12, borderWidth: 2, borderColor: '#1677FF', backgroundColor: '#F0F7FF', padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 22, marginRight: 10 }}>💙</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1677FF' }}>支付寶</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>App 支付（人民幣 RMB）</Text>
                </View>
                <View style={{ backgroundColor: '#1677FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>推薦</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[{ backgroundColor: '#1677FF', borderRadius: 10, paddingVertical: 13, alignItems: 'center' }, (submitting || !finalIPoint || finalIPoint < 1) && { opacity: 0.5 }]}
                onPress={handleAlipayPay}
                disabled={submitting || !finalIPoint || finalIPoint < 1}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>支付寶支付 RMB {cnyAmount}</Text>
                }
              </TouchableOpacity>
            </View>

            {/* 微信支付 — 即將開通，排在支付寶後面 */}
            <View style={s.methodItemDisabled}>
              <Text style={s.methodIcon}>💚</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.methodNameDisabled}>微信支付</Text>
                <Text style={s.methodType}>APP 支付（即將開通）</Text>
              </View>
              <View style={s.comingSoonBadge}><Text style={s.comingSoonText}>即將開通</Text></View>
            </View>

          <View style={{ height: 16 }} />
          <TouchableOpacity
            style={[s.primaryBtn, (!selectedMethod || submitting) && s.primaryBtnDisabled]}
            onPress={handleOfflineNext}
            disabled={!selectedMethod || submitting}
            activeOpacity={0.8}
          >
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryBtnText}>下一步</Text>}
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── 主頁面 ──
  const balance = balanceData?.balance ?? 0;
  const totalEarned = balanceData?.totalEarned ?? 0;
  const totalSpent = balanceData?.totalSpent ?? 0;
  const transactions = txData?.items || [];
  const pendingList = (pendingOrders || []).filter((o: any) => o.status === 'pending');

  return (
    <View style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>iPoint</Text></View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#F97316"
            colors={["#F97316"]}
          />
        }
      >

        {/* 餘額卡片 */}
        <View style={s.balanceCard}>
          <Text style={s.balanceCardLabel}>當前餘額</Text>
          <View style={s.balanceRow}>
            <Text style={s.balanceValue}>{balance.toLocaleString()}</Text>
            <Text style={s.balanceUnit}> iP</Text>
          </View>
          <Text style={s.balanceStat}>累計獲得 {totalEarned}　累計消費 {totalSpent}</Text>
          <View style={s.balanceBtns}>
            <TouchableOpacity style={s.balanceBtn} onPress={() => setScreen('recharge-step1')} activeOpacity={0.8}>
              <Text style={s.balanceBtnText}>充值</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.balanceBtn} onPress={() => router.push('/profile/ipoint-tasks' as any)} activeOpacity={0.8}>
              <Text style={s.balanceBtnText}>做任務</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 待審核充值訂單 */}
        {pendingList.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>⏳ 待審核充值</Text>
            {pendingList.map((order: any) => (
              <View key={order.id} style={s.pendingItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pendingDesc}>充值 {order.ipointAmount} iP</Text>
                  <Text style={s.pendingOrderNo}>{order.orderNo}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.pendingAmount}>+{order.ipointAmount} iP</Text>
                  <Text style={s.pendingStatus}>等待審核</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 交易記錄 + 篩選 */}
        <View style={s.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {TX_TYPE_TABS.map((tab) => {
              const active = txFilterType === tab.key;
              return (
                <TouchableOpacity
                  key={String(tab.key)}
                  style={[s.tabChip, active && s.tabChipActive]}
                  onPress={() => setTxFilterType(tab.key as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabChipText, active && s.tabChipTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {transactions.length === 0 ? (
            <View style={s.emptyBox}><Text style={s.emptyText}>暫無交易記錄</Text></View>
          ) : (
            transactions.map((tx: any, i: number) => {
              const meta = TX_TYPE_META[tx.type] || TX_TYPE_META.admin_adjust;
              const isPositive = tx.amount > 0;
              return (
                <View key={tx.id || i} style={[s.txItem, i < transactions.length - 1 && s.txItemBorder]}>
                  <View style={[s.txIconWrap, { backgroundColor: meta.color + '18' }]}>
                    <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                  </View>
                  <View style={s.txLeft}>
                    <Text style={s.txDesc} numberOfLines={1}>{tx.description || meta.label}</Text>
                    <Text style={s.txDate}>
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.txAmount, isPositive ? s.txAmountIn : s.txAmountOut]}>
                      {isPositive ? '+' : ''}{tx.amount} iP
                    </Text>
                    <Text style={s.txBalance}>餘額 {tx.balanceAfter}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── 輔助組件 ─────────────────────────────────────────────────────────────
function SRow({ label, value, mono, orange, amber }: { label: string; value: string; mono?: boolean; orange?: boolean; amber?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ fontSize: 13, color: APP_GRAY }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: orange ? APP_ORANGE : amber ? '#D97706' : APP_TEXT, fontFamily: mono ? 'monospace' : undefined }}>
        {value}
      </Text>
    </View>
  );
}

function DRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER }}>
      <Text style={{ fontSize: 13, color: APP_GRAY, width: 72 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: APP_TEXT, flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

// ── 樣式 ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: APP_TEXT, textAlign: 'center' },
  backBtn: { position: 'absolute', left: 16, top: 52, padding: 8 },
  backBtnText: { fontSize: 28, color: APP_TEXT, lineHeight: 32 },
  balanceCard: { margin: 16, borderRadius: 16, padding: 20, backgroundColor: APP_ORANGE, shadowColor: APP_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  balanceCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  balanceValue: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  balanceUnit: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  balanceStat: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  balanceBtns: { flexDirection: 'row', gap: 8 },
  balanceBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  balanceBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: APP_TEXT, marginBottom: 12 },
  pendingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  pendingDesc: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  pendingOrderNo: { fontSize: 11, color: APP_GRAY, marginTop: 2, fontFamily: 'monospace' },
  pendingAmount: { fontSize: 14, fontWeight: '700', color: '#D97706' },
  pendingStatus: { fontSize: 11, color: '#D97706', marginTop: 2 },
  tabChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: APP_BORDER, marginRight: 8 },
  tabChipActive: { backgroundColor: APP_ORANGE, borderColor: APP_ORANGE },
  tabChipText: { fontSize: 12, fontWeight: '500', color: APP_GRAY },
  tabChipTextActive: { color: '#fff' },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  txItemBorder: { borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  txIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txLeft: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '500', color: APP_TEXT },
  txDate: { fontSize: 11, color: APP_GRAY, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountIn: { color: '#16a34a' },
  txAmountOut: { color: '#ef4444' },
  txBalance: { fontSize: 10, color: APP_GRAY, marginTop: 2 },
  emptyBox: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: APP_GRAY },
  formContent: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 10 },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  amountBtn: { width: '30%', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff', alignItems: 'center' },
  amountBtnActive: { borderColor: APP_ORANGE, backgroundColor: APP_ORANGE + '10' },
  amountBtnText: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  amountBtnTextActive: { color: APP_ORANGE },
  customInput: { borderWidth: 1, borderColor: APP_BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: APP_TEXT, backgroundColor: '#fff' },
  ipointRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  ipointLabel: { fontSize: 12, color: APP_GRAY },
  ipointValue: { fontSize: 13, fontWeight: '700', color: APP_ORANGE },
  methodList: { gap: 8, marginBottom: 8 },
  methodItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fff', gap: 12 },
  methodItemActive: { borderColor: APP_ORANGE, backgroundColor: APP_ORANGE + '08' },
  methodItemDisabled: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: APP_BORDER, backgroundColor: '#F9F9F9', opacity: 0.6, marginTop: 8, gap: 12 },
  methodIcon: { fontSize: 22 },
  methodName: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  methodNameActive: { color: APP_ORANGE },
  methodNameDisabled: { fontSize: 14, fontWeight: '600', color: APP_GRAY },
  methodType: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  comingSoonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F3F4F6' },
  comingSoonText: { fontSize: 11, color: APP_GRAY },
  noMethodBox: { padding: 20, alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 12 },
  noMethodText: { fontSize: 13, color: APP_GRAY },
  methodDetailCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: APP_ORANGE + '10', borderRadius: 12, padding: 14, marginBottom: 16, gap: 12 },
  methodDetailIcon: { fontSize: 28 },
  methodDetailName: { fontSize: 15, fontWeight: '700', color: APP_TEXT },
  methodDetailType: { fontSize: 12, color: APP_GRAY },
  methodDetailAmount: { fontSize: 12, color: APP_ORANGE, marginTop: 2 },
  detailCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: APP_BORDER, marginBottom: 16 },
  qrWrap: { alignItems: 'center', marginBottom: 16 },
  qrImage: { width: 180, height: 180, borderRadius: 12, borderWidth: 1, borderColor: APP_BORDER },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: APP_TEXT, marginBottom: 8 },
  remarkInput: { borderWidth: 1, borderColor: APP_BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: APP_TEXT, backgroundColor: '#fff', marginBottom: 16 },
  tipBox: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 16 },
  tipText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  uploadBox: { borderWidth: 2, borderStyle: 'dashed', borderColor: APP_BORDER, borderRadius: 12, height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9', marginBottom: 8 },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 14, color: APP_GRAY },
  uploadHint: { fontSize: 11, color: APP_GRAY, marginTop: 4 },
  uploadPreview: { width: '100%', height: '100%', borderRadius: 10 },
  rePickBtn: { alignSelf: 'center', marginBottom: 16 },
  rePickText: { fontSize: 13, color: APP_ORANGE },
  formMeta: { fontSize: 13, color: APP_GRAY, marginBottom: 4 },
  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  successSub: { fontSize: 13, color: APP_GRAY, marginBottom: 24, textAlign: 'center' },
  successCard: { width: '100%', backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, marginBottom: 24 },
  primaryBtn: { height: 50, borderRadius: 14, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnDisabled: { backgroundColor: '#ffb380' },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  guestWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: APP_BG, padding: 32 },
  guestIcon: { fontSize: 64, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  guestSub: { fontSize: 14, color: APP_GRAY, marginBottom: 32, textAlign: 'center' },
  loginBtn: { width: 200, height: 48, borderRadius: 24, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
