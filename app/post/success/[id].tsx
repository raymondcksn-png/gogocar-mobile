/**
 * 發佈成功頁 — 確認發佈 + 支付方案選擇
 * 對照 WebApp AppPostSuccess.tsx
 * 流程：提交草稿 → 此頁選擇發佈方案 → iPoint 扣款 / 微信支付 → 上架
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc, resolveImageUrl } from '../../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../../constants/data';

type PublishPlan = 'basic' | 'featured' | 'pinned';
type PaymentMethod = 'ipoint' | 'wechat';

function getPublishOptions(settings: Record<string, string>) {
  const basicPrice = parseInt(settings.publish_basic_price || '100');
  const featuredPrice = parseInt(settings.publish_featured_price || '150');
  const pinnedPrice = parseInt(settings.publish_pinned_price || '200');
  const publishDays = settings.publish_duration_days || '30';
  const featuredDays = settings.featured_duration_days || '7';
  const pinnedDays = settings.pinned_duration_days || '3';
  return [
    { plan: 'basic' as PublishPlan, label: '普通發佈', desc: `上架 ${publishDays} 天，按時間排序`, cost: basicPrice },
    { plan: 'featured' as PublishPlan, label: '普通發佈 + 精選推薦', desc: `上架 ${publishDays} 天 + 精選標記 ${featuredDays} 天`, cost: featuredPrice, badge: '精選', badgeColor: '#F97316' },
    { plan: 'pinned' as PublishPlan, label: '普通發佈 + 黃金置頂', desc: `上架 ${publishDays} 天 + 置頂效果 ${pinnedDays} 天`, cost: pinnedPrice, badge: '置頂', badgeColor: '#EAB308' },
  ];
}

function mopToCny(mop: number, rate: number): string {
  return (mop * rate).toFixed(2);
}

export default function PostSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const postId = Number(id);

  const [publishPlan, setPublishPlan] = useState<PublishPlan>('basic');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ipoint');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: postData, isLoading } = trpc.vehicle.getPostById.useQuery(
    { id: postId },
    { enabled: !!postId && postId > 0 }
  );
  const { data: rateData } = trpc.wechatPay.getExchangeRate.useQuery();
  const { data: balanceData } = trpc.ipoint.getBalance.useQuery(undefined, { retry: false });

  const exchangeRate = (rateData as any)?.rate ?? 0.88;
  // 使用默認定價（後端 ipoint.publishVehicle 會從 platformSettings 讀取正確定價）
  const PUBLISH_OPTIONS = getPublishOptions({});
  const selectedOption = PUBLISH_OPTIONS.find(o => o.plan === publishPlan)!;
  const ipointBalance = (balanceData as any)?.balance ?? 0;

  const publishMutation = trpc.ipoint.publishVehicle.useMutation({
    onSuccess: () => {
      setIsProcessing(false);
      setIsConfirmed(true);
    },
    onError: (err: any) => {
      setIsProcessing(false);
      Alert.alert('發佈失敗', err.message || '請稍後重試');
    },
  });

  const createWechatOrderMutation = trpc.wechatPay.createVehiclePublishH5Order.useMutation({
    onSuccess: (data: any) => {
      setIsProcessing(false);
      if (data?.payUrl) {
        Linking.openURL(data.payUrl);
      } else {
        Alert.alert('支付失敗', '無法獲取支付鏈接');
      }
    },
    onError: (err: any) => {
      setIsProcessing(false);
      Alert.alert('支付失敗', err.message || '請稍後重試');
    },
  });

  const handleConfirm = () => {
    if (paymentMethod === 'ipoint') {
      if (ipointBalance < selectedOption.cost) {
        Alert.alert('iPoint 不足', `您的 iPoint 餘額（${ipointBalance}）不足以支付 ${selectedOption.cost} iPoint`, [
          { text: '充值 iPoint', onPress: () => router.push('/profile' as any) },
          { text: '取消', style: 'cancel' },
        ]);
        return;
      }
      Alert.alert('確認發佈', `扣除 ${selectedOption.cost} iPoint，發佈「${selectedOption.label}」方案？`, [
        {
          text: '確認', onPress: () => {
            setIsProcessing(true);
            publishMutation.mutate({ postId, publishPlan, paymentMethod: 'ipoint' } as any);
          }
        },
        { text: '取消', style: 'cancel' },
      ]);
    } else {
      setIsProcessing(true);
      createWechatOrderMutation.mutate({ postId, publishPlan, returnUrl: 'https://gogocar853.manus.space/app/my-posts' } as any);
    }
  };

  if (isLoading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={APP_ORANGE} size="large" />
      </View>
    );
  }

  const post = postData as any;
  const photos = (post?.photos || []) as any[];
  const coverUrl = photos[0]?.url ? resolveImageUrl(photos[0].url) : null;

  if (isConfirmed) {
    return (
      <View style={s.confirmedWrap}>
        <View style={s.confirmedIcon}>
          <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
        </View>
        <Text style={s.confirmedTitle}>發佈成功！</Text>
        <Text style={s.confirmedSub}>您的車源已提交審核，通常在 1-2 工作日內完成</Text>
        {/* 車源摘要 */}
        {post && (
          <View style={s.summaryCard}>
            {coverUrl && <Image source={{ uri: coverUrl }} style={s.summaryImg} contentFit="cover" />}
            <View style={s.summaryInfo}>
              <Text style={s.summaryName} numberOfLines={2}>{post.brandName} {post.modelName}</Text>
              {post.price && <Text style={s.summaryPrice}>HKD {Number(post.price).toLocaleString()}</Text>}
            </View>
          </View>
        )}
        {/* 狀態說明 */}
        <View style={s.statusCard}>
          {[
            { icon: '草', bg: '#f5f5f7', color: '#6b7280', title: '草稿', desc: '已填寫但尚未支付發佈，只有您可見' },
            { icon: '審', bg: '#FEF3C7', color: '#B45309', title: '審核中', desc: '支付待確認，通常在 1-2 工作日內完成' },
            { icon: '售', bg: '#DCFCE7', color: '#15803D', title: '在售', desc: '已展示給所有買家，可收到詢問訊息' },
            { icon: '售', bg: '#E5E7EB', color: '#4B5563', title: '已售', desc: '車輛已成功成交，車源自動下架' },
          ].map((item, i) => (
            <View key={i} style={[s.statusRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }]}>
              <View style={[s.statusDot, { backgroundColor: item.bg }]}>
                <Text style={[s.statusDotText, { color: item.color }]}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statusTitle}>{item.title}</Text>
                <Text style={s.statusDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={s.confirmedBtns}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/my-posts' as any)} activeOpacity={0.85}>
            <Ionicons name="list" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>查看我的車源</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/(tabs)/buy' as any)} activeOpacity={0.85}>
            <Text style={s.secondaryBtnText}>返回首頁</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: APP_BG }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>確認發佈</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 車源摘要 */}
        {post && (
          <View style={s.card}>
            <View style={s.summaryRow}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={s.summaryThumb} contentFit="cover" />
              ) : (
                <View style={[s.summaryThumb, { backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 28 }}>🚗</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.summaryName2} numberOfLines={2}>{post.brandName} {post.modelName}{post.subtitle ? ` · ${post.subtitle}` : ''}</Text>
                {(post.year || post.mileage) && (
                  <Text style={s.summaryDetail}>{[post.year && `${post.year}年`, post.mileage && `${Number(post.mileage).toLocaleString()}km`, post.transmission === 'auto' ? '自動' : post.transmission === 'manual' ? '手動' : ''].filter(Boolean).join(' · ')}</Text>
                )}
                <Text style={s.summaryPrice2}>
                  {post.price && Number(post.price) > 0 ? `HKD ${Number(post.price).toLocaleString()}` : '面議'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 發佈方案 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>選擇發佈方案</Text>
          {PUBLISH_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.plan}
              style={[s.planBtn, publishPlan === option.plan && s.planBtnActive]}
              onPress={() => setPublishPlan(option.plan)}
              activeOpacity={0.8}
            >
              <View style={[s.planRadio, publishPlan === option.plan && s.planRadioActive]}>
                {publishPlan === option.plan && <View style={s.planRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.planLabel, publishPlan === option.plan && { color: APP_ORANGE }]}>{option.label}</Text>
                  {(option as any).badge && (
                    <View style={[s.planBadge, { backgroundColor: (option as any).badgeColor }]}>
                      <Text style={s.planBadgeText}>{(option as any).badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.planDesc}>{option.desc}</Text>
              </View>
              <Text style={[s.planCost, publishPlan === option.plan && { color: APP_ORANGE }]}>{option.cost} iP</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 支付方式 */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>支付方式</Text>
          {/* iPoint */}
          <TouchableOpacity style={[s.payBtn, paymentMethod === 'ipoint' && s.payBtnActive]} onPress={() => setPaymentMethod('ipoint')} activeOpacity={0.8}>
            <View style={[s.planRadio, paymentMethod === 'ipoint' && s.planRadioActive]}>
              {paymentMethod === 'ipoint' && <View style={s.planRadioDot} />}
            </View>
            <View style={s.payIcon}>
              <Ionicons name="wallet" size={20} color={APP_ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.payLabel}>iPoint 積分</Text>
              <Text style={s.payDesc}>餘額：{ipointBalance} iPoint · 即時扣款，即時上架</Text>
            </View>
          </TouchableOpacity>
          {/* 微信支付 */}
          <TouchableOpacity style={[s.payBtn, paymentMethod === 'wechat' && s.payBtnActive, { marginTop: 8 }]} onPress={() => setPaymentMethod('wechat')} activeOpacity={0.8}>
            <View style={[s.planRadio, paymentMethod === 'wechat' && s.planRadioActive]}>
              {paymentMethod === 'wechat' && <View style={s.planRadioDot} />}
            </View>
            <View style={[s.payIcon, { backgroundColor: '#07C160' }]}>
              <Ionicons name="logo-wechat" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.payLabel}>微信支付</Text>
              {paymentMethod === 'wechat' && selectedOption && (
                <Text style={s.payDesc}>
                  MOP {selectedOption.cost} ≈ CNY {mopToCny(selectedOption.cost, exchangeRate)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* 確認按鈕 */}
        <TouchableOpacity
          style={[s.confirmBtn, isProcessing && s.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={isProcessing}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          )}
          <Text style={s.confirmBtnText}>
            {isProcessing ? '處理中...' : `確認發佈 · ${selectedOption?.cost} ${paymentMethod === 'ipoint' ? 'iPoint' : 'MOP'}`}
          </Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: APP_BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  headerTitle: { fontSize: 17, fontWeight: '700', color: APP_TEXT },
  card: { backgroundColor: '#fff', borderRadius: 16, margin: 12, marginBottom: 0, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: APP_TEXT, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  summaryThumb: { width: 90, height: 68, borderRadius: 10 },
  summaryName2: { fontSize: 14, fontWeight: '600', color: APP_TEXT, lineHeight: 20 },
  summaryDetail: { fontSize: 12, color: APP_GRAY, marginTop: 3 },
  summaryPrice2: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, marginTop: 4 },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER, marginBottom: 8, backgroundColor: '#fafafa' },
  planBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  planRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: APP_BORDER, alignItems: 'center', justifyContent: 'center' },
  planRadioActive: { borderColor: APP_ORANGE },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_ORANGE },
  planLabel: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  planDesc: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  planCost: { fontSize: 15, fontWeight: '700', color: APP_GRAY },
  planBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: '#fafafa' },
  payBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  payIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${APP_ORANGE}20`, alignItems: 'center', justifyContent: 'center' },
  payLabel: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  payDesc: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: APP_ORANGE, borderRadius: 16, marginHorizontal: 12, marginTop: 16, paddingVertical: 16 },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // 確認成功頁
  confirmedWrap: { flex: 1, backgroundColor: APP_BG, padding: 24, alignItems: 'center' },
  confirmedIcon: { marginTop: 40, marginBottom: 16 },
  confirmedTitle: { fontSize: 24, fontWeight: '800', color: APP_TEXT, marginBottom: 8 },
  confirmedSub: { fontSize: 14, color: APP_GRAY, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  summaryCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, width: '100%', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryImg: { width: 80, height: 60, borderRadius: 10 },
  summaryInfo: { flex: 1, justifyContent: 'center' },
  summaryName: { fontSize: 14, fontWeight: '600', color: APP_TEXT, lineHeight: 20 },
  summaryPrice: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, marginTop: 4 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, width: '100%', overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  statusDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusDotText: { fontSize: 11, fontWeight: '700' },
  statusTitle: { fontSize: 13, fontWeight: '600', color: APP_TEXT },
  statusDesc: { fontSize: 11, color: APP_GRAY, marginTop: 2 },
  confirmedBtns: { width: '100%', gap: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: APP_ORANGE, borderRadius: 14, paddingVertical: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: APP_BORDER },
  secondaryBtnText: { color: APP_GRAY, fontWeight: '600', fontSize: 15 },
});
