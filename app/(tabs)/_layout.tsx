/**
 * Tab 導航佈局 — GoGoCar Native App
 * 6 個 Tab：首頁 / 買車 / 賣車 / 考車 / 通關 / 我的
 * 圖標完全對照 WebApp AppShell.tsx 的 SVG 路徑
 */
import React from 'react';
import { Tabs } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text as SvgText } from 'react-native-svg';

const APP_ORANGE = '#FF6B00';
const APP_GRAY = '#8E8E93';

// ── 首頁圖標（房子，填充風格）
function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3.172 2.515 11.07a1 1 0 0 0 .64 1.77H4.5V20a1 1 0 0 0 1 1h3.5v-5.25A1.25 1.25 0 0 1 10.25 14.5h3.5A1.25 1.25 0 0 1 15 15.75V21h3.5a1 1 0 0 0 1-1v-7.16h1.345a1 1 0 0 0 .64-1.77L12 3.172Z" />
    </Svg>
  );
}

// ── 買車圖標（汽車，填充風格）
function BuyIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill={color}>
      <Path d="M5.5 11 7 7.2A2 2 0 0 1 8.86 6h6.28A2 2 0 0 1 17 7.2L18.5 11H20a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-1v1a1.5 1.5 0 1 1-3 0v-1H8v1a1.5 1.5 0 1 1-3 0v-1H4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1h1.5Zm1.65 0h9.7l-1.05-2.65a.75.75 0 0 0-.7-.47H8.9a.75.75 0 0 0-.7.47L7.15 11ZM7 14.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </Svg>
  );
}

// ── 賣車圖標（汽車+右上角$圓圈，填充風格）
function SellIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill={color}>
      <Path d="M3 11.5 4.3 8.1A2 2 0 0 1 6.16 6.8h5.04l-.31.75A2 2 0 0 0 12.7 10.3H17l.7 1.2H19a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-.5v.75a1.25 1.25 0 1 1-2.5 0V17.5H7v.75a1.25 1.25 0 1 1-2.5 0V17.5H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Zm1.7 0h7.4l-.9-2.1H6.1l-1.4 2.1ZM6 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
      <Circle cx={18} cy={5.5} r={4} fill={color} />
      <SvgText x="18" y="7.4" textAnchor="middle" fontSize="5.4" fontWeight="700" fill="#fff">$</SvgText>
    </Svg>
  );
}

// ── 考車圖標（方向盤，填充風格）
function ExamIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 0 1 6.93 6h-4.66a2.5 2.5 0 0 0-4.54 0H5.07A7 7 0 0 1 12 5Zm-1 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm-5.93 1h4.66a2.5 2.5 0 0 0 1.77 1.77V18.93A7 7 0 0 1 5.07 13Zm7.93 5.93V14.77A2.5 2.5 0 0 0 14.27 13h4.66A7 7 0 0 1 13 18.93Z" />
    </Svg>
  );
}

// ── 通關圖標（地球，填充風格）
function BorderIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z" />
    </Svg>
  );
}

// ── 我的圖標（人像，填充風格）
function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5ZM4 20.5c0-3.452 3.582-6.25 8-6.25s8 2.798 8 6.25c0 .69-.56 1.25-1.25 1.25H5.25C4.56 21.75 4 21.19 4 20.5Z" />
    </Svg>
  );
}

// ── Tab 佈局
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
        name="exam"
        options={{
          title: '考車',
          tabBarIcon: ({ color }) => <ExamIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="border"
        options={{
          title: '通關',
          tabBarIcon: ({ color }) => <BorderIcon color={color} />,
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
