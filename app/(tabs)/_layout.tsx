/**
 * Tab 導航佈局 — GoGoCar Native App
 * 6 個 Tab：首頁 / 買車 / 賣車 / iPoint / 我的
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { APP_ORANGE, APP_GRAY } from '../../constants/data';

// ── Tab 圖標組件 ──────────────────────────────────────────────────────────────
function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 21V12h6v9" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function BuyIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M21 7l-3 9H6L3 7h18z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={9} cy={20} r={1} fill={color} />
      <Circle cx={15} cy={20} r={1} fill={color} />
      <Path d="M1 3h3l2 4" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function SellIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M12 7v10M9 10l3-3 3 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IPointIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Text style={{ fontSize: 11, fontWeight: '700', color, position: 'absolute', left: 7, top: 5 }}>iP</Text>
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// ── iPoint 特殊圖標（文字） ───────────────────────────────────────────────────
function IPointTabIcon({ color }: { color: string }) {
  return (
    <View style={styles.iPointIcon}>
      <Text style={[styles.iPointText, { color }]}>iP</Text>
    </View>
  );
}

// ── Tab 佈局 ──────────────────────────────────────────────────────────────────
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: APP_ORANGE,
        tabBarInactiveTintColor: APP_GRAY,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e5ea',
          borderTopWidth: 0.5,
          height: 83,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="buy"
        options={{
          title: '買車',
          tabBarIcon: ({ color }) => <BuyIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: '賣車',
          tabBarIcon: ({ color }) => <SellIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="ipoint"
        options={{
          title: 'iPoint',
          tabBarIcon: ({ color }) => <IPointTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iPointIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'currentColor',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iPointText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
