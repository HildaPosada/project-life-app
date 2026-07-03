import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  authError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ROOT = "https://auth.emergentagent.com";

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.location.origin + "/" : "/";
  }
  return Linking.createURL("auth");
}

// Robust session_id extraction. Supports:
//   .../path#session_id=xxx
//   .../path?session_id=xxx
//   .../path#session_id=xxx&foo=bar
function parseSessionId(url: string): string | null {
  if (!url) return null;
  try {
    // Strip protocol-relative / custom schemes safely by giving URL a base if needed.
    const u = new URL(url);
    // Try search first
    const q = u.searchParams.get("session_id");
    if (q) return q;
    // Then hash — strip leading '#'
    const rawHash = u.hash.startsWith("#") ? u.hash.substring(1) : u.hash;
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const h = hashParams.get("session_id");
      if (h) return h;
    }
  } catch {
    // Fallback: regex scan
    const m = /(?:[?#&])session_id=([^&#]+)/.exec(url);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      await clearToken();
      return null;
    }
  }, []);

  const finishLoginWithSessionId = useCallback(async (sessionId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const resp = await api.createSession(sessionId);
      await setToken(resp.session_token);
      setUser(resp.user);
      setAuthError(null);
    } catch (e: any) {
      setAuthError(
        "We couldn't confirm your sign-in. Please try again — if it keeps happening, close this tab and start over.",
      );
      // eslint-disable-next-line no-console
      console.warn("[auth] session exchange failed", e?.message ?? e);
    } finally {
      processingRef.current = false;
    }
  }, []);

  const login = useCallback(async () => {
    setAuthError(null);
    const redirectUrl = getRedirectUrl();
    const authUrl = `${AUTH_ROOT}/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.location.href = authUrl;
      return;
    }

    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === "success" && result.url) {
        const sid = parseSessionId(result.url);
        if (sid) {
          await finishLoginWithSessionId(sid);
        } else {
          setAuthError("Sign-in returned but no session was found. Please try again.");
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // Silent — user backed out.
      } else {
        setAuthError("Sign-in was interrupted. Please try again.");
      }
    } catch (e: any) {
      setAuthError("Could not open the sign-in window. Please try again.");
      // eslint-disable-next-line no-console
      console.warn("[auth] openAuthSessionAsync failed", e?.message ?? e);
    }
  }, [finishLoginWithSessionId]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    await clearToken();
    setUser(null);
  }, []);

  // Bootstrap on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // WEB — check current URL for session_id (from OAuth redirect)
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = parseSessionId(window.location.href);
          if (sid) {
            try {
              await finishLoginWithSessionId(sid);
            } finally {
              // Clean the URL so we don't reprocess on refresh
              if (typeof window.history?.replaceState === "function") {
                window.history.replaceState(null, "", window.location.pathname);
              }
            }
            if (!alive) return;
            setLoading(false);
            return;
          }
        } else {
          // MOBILE — check cold-start deep link
          const initial = await Linking.getInitialURL();
          if (initial) {
            const sid = parseSessionId(initial);
            if (sid) {
              await finishLoginWithSessionId(sid);
              if (!alive) return;
              setLoading(false);
              return;
            }
          }
        }
        // No fresh session_id → try an existing session_token
        await refresh();
      } finally {
        if (alive) setLoading(false);
      }
    })();

    let sub: { remove: () => void } | null = null;
    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", ({ url }) => {
        const sid = parseSessionId(url);
        if (sid) finishLoginWithSessionId(sid).catch(() => {});
      });
    }

    return () => {
      alive = false;
      if (sub) sub.remove();
    };
  }, [refresh, finishLoginWithSessionId]);

  const value = useMemo(
    () => ({ user, loading, authError, login, logout, refresh: async () => { await refresh(); }, clearAuthError }),
    [user, loading, authError, login, logout, refresh, clearAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
