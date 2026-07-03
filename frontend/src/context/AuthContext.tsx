import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";

import { supabase } from "@/src/lib/supabase";
import { api } from "@/src/lib/api";

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
  entitlement?: "free" | "premium";
  entitlement_source?: string | null;
  entitlement_product?: string | null;
  entitlement_expires_at?: string | null;
  trial_ends_at?: string | null;
};

type AuthContextValue = {
  user: User | null;
  session: any | null;
  loading: boolean;
  authError: string | null;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ needsVerification: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function redirectUrl(path: string = "auth"): string {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.location.origin + "/" + path : "/" + path;
  }
  return Linking.createURL(path);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Ensure our MongoDB user record exists / is up to date whenever we get a session.
  const syncProfile = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      if (data.session) await syncProfile();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) {
        await syncProfile();
      } else {
        setUser(null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [syncProfile]);

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectUrl("auth-confirmed"),
      },
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    // If email confirmation is required, session will be null.
    const needsVerification = !data.session;
    return { needsVerification };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const redirect = redirectUrl("auth-callback");
    if (Platform.OS === "web") {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirect },
      });
      if (error) setAuthError(error.message);
      return;
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      setAuthError(error?.message ?? "Could not start Google sign-in");
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirect);
    if (result.type === "success" && result.url) {
      // Parse tokens from the returned URL and set the session
      try {
        const url = new URL(result.url);
        const hash = url.hash.startsWith("#") ? url.hash.substring(1) : url.hash;
        const params = new URLSearchParams(hash || url.search);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) setAuthError(setErr.message);
        }
      } catch (e: any) {
        setAuthError("Could not complete Google sign-in.");
      }
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setAuthError(null);
    if (Platform.OS !== "ios") {
      setAuthError("Apple Sign-In is available on iOS native builds.");
      return;
    }
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        setAuthError("Apple Sign-In is not available on this device.");
        return;
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setAuthError("Apple did not return a token. Please try again.");
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) setAuthError(error.message);
    } catch (e: any) {
      if (e.code === "ERR_REQUEST_CANCELED") return;
      setAuthError(e.message || "Apple Sign-In failed.");
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl("reset-password"),
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    await syncProfile();
  }, [syncProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, session, loading, authError,
      signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple,
      forgotPassword, updatePassword, logout, refresh, clearAuthError,
    }),
    [user, session, loading, authError, signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple, forgotPassword, updatePassword, logout, refresh, clearAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
