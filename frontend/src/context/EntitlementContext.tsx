import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

export type Entitlement = {
  is_premium: boolean;
  entitlement: "free" | "premium";
  source: string | null;
  product: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
};

type EntitlementContextValue = {
  entitlement: Entitlement | null;
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  // Mock helpers — will be replaced by real RevenueCat / Stripe purchase
  // flows in Sprint 2b. Kept behind explicit method names so we can grep for
  // and remove them later without breaking the paywall UI.
  mockUnlock: (product?: string) => Promise<void>;
  mockLock: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setEntitlement(null);
      return;
    }
    setLoading(true);
    try {
      const e = await api.getEntitlement();
      setEntitlement(e);
    } catch {
      // Non-fatal — default to free.
      setEntitlement({
        is_premium: false,
        entitlement: "free",
        source: null,
        product: null,
        expires_at: null,
        trial_ends_at: null,
      });
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh, user?.user_id]);

  const mockUnlock = useCallback(async (product?: string) => {
    const e = await api.mockEntitlement({ premium: true, product });
    setEntitlement(e);
  }, []);

  const mockLock = useCallback(async () => {
    const e = await api.mockEntitlement({ premium: false });
    setEntitlement(e);
  }, []);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      entitlement,
      isPremium: !!entitlement?.is_premium,
      loading,
      refresh,
      mockUnlock,
      mockLock,
    }),
    [entitlement, loading, refresh, mockUnlock, mockLock],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useEntitlement must be used within EntitlementProvider");
  return ctx;
}
