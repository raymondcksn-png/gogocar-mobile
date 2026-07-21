/**
 * Auth 佈局 — 登入/註冊/忘記密碼/OTP 頁面
 */
import { Stack } from 'expo-router';
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
