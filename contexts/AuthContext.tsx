/**
 * Auth Context — GoGoCar Native App
 * 使用 SecureStore 持久化 JWT token
 * 修復登出 bug：登出時必須清除 SecureStore 中的 token + 重置 auth 狀態
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: number;
  phone: string;
  name?: string | null;
  role?: string;
  avatarUrl?: string | null;
  iPointBalance?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (user: AuthUser) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'auth_user';

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 啟動時從 SecureStore 恢復 session
  useEffect(() => {
    async function restoreSession() {
      try {
        const [savedToken, savedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser) as AuthUser;
          setToken(savedToken);
          setUser(parsedUser);
        }
      } catch (err) {
        console.warn('[AuthContext] Failed to restore session:', err);
        // 清除損壞的數據
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  // 登入：保存 token + user 到 SecureStore
  const setAuth = useCallback(async (newToken: string, newUser: AuthUser) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, newToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser)),
      ]);
      setToken(newToken);
      setUser(newUser);
    } catch (err) {
      console.error('[AuthContext] Failed to save auth:', err);
      throw err;
    }
  }, []);

  /**
   * 登出 — 修復 bug 的核心邏輯
   * 必須：
   * 1. 從 SecureStore 刪除 jwt_token
   * 2. 從 SecureStore 刪除 auth_user
   * 3. 重置 React state（token=null, user=null）
   * 不能只調用後端 logout API，否則 app 重啟後會從 SecureStore 恢復登入狀態
   */
  const logout = useCallback(async () => {
    try {
      // Step 1: 先清除 SecureStore（最重要）
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
    } catch (err) {
      console.warn('[AuthContext] Failed to clear SecureStore on logout:', err);
    } finally {
      // Step 2: 無論 SecureStore 是否成功，都重置 React state
      setToken(null);
      setUser(null);
    }
  }, []);

  // 更新用戶信息（不改變 token）
  const refreshUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(updatedUser)).catch(() => {});
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isLoggedIn: !!token && !!user,
    setAuth,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
