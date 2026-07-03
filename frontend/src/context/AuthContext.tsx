import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { api, clearToken, setToken } from "@/src/lib/api";

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  pronouns?: string | null;
  location?: string | null;
  in_therapy?: boolean | null;
  consent_accepted: boolean;
  onboarding_complete: boolean;
  current_phase: number;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ROOT = "https://auth.emergentagent.com";

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.location.origin + "/" : "/";
  }
  return Linking.createURL("auth");
}

function parseSessionId(url: string): string | null {
  try {
    const u = new URL(url);
    const hash = u.hash?.startsWith("#") ? u.hash.substring(1) : u.hash || "";
    const hashParams = new URLSearchParams(hash);
    if (hashParams.get("session_id")) return hashParams.get("session_id");
    return u.searchParams.get("session_id");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  const finishLoginWithSessionId = useCallback(async (sessionId: string) => {
    const resp = await api.createSession(sessionId);
    await setToken(resp.session_token);
    setUser(resp.user);
  }, []);

  const login = useCallback(async () => {
    const redirectUrl = getRedirectUrl();
    const authUrl = `${AUTH_ROOT}/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = parseSessionId(result.url);
      if (sid) {
        await finishLoginWithSessionId(sid);
      }
    }
  }, [finishLoginWithSessionId]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    await clearToken();
    setUser(null);
  }, []);

  // Initial bootstrap
  useEffect(() => {
    (async () => {
      try {
        // Web: check URL for session_id first
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const combined = window.location.hash + "?" + window.location.search.substring(1);
          const sid = parseSessionId(window.location.origin + "/" + combined);
          if (sid) {
            try {
              await finishLoginWithSessionId(sid);
              window.history.replaceState(null, "", window.location.pathname);
              setLoading(false);
              return;
            } catch { /* fall through */ }
          }
        } else {
          // Mobile cold start deep link
          const initial = await Linking.getInitialURL();
          if (initial) {
            const sid = parseSessionId(initial);
            if (sid) {
              try {
                await finishLoginWithSessionId(sid);
                setLoading(false);
                return;
              } catch { /* fall through */ }
            }
          }
        }
        await refresh();
      } finally {
        setLoading(false);
      }
    })();

    // Mobile: also listen for hot deep links
    if (Platform.OS !== "web") {
      const sub = Linking.addEventListener("url", ({ url }) => {
        const sid = parseSessionId(url);
        if (sid) finishLoginWithSessionId(sid).catch(() => {});
      });
      return () => sub.remove();
    }
  }, [refresh, finishLoginWithSessionId]);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, setUser }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
