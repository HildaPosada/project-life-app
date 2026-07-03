import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

// Adapter so supabase-js can persist sessions using our unified storage
// (expo-secure-store on mobile, localStorage on web).
const supabaseStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return (await storage.secureGet<string>(key, "")) || null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await storage.secureSet(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await storage.secureRemove(key);
  },
};

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    storage: supabaseStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    // Session detection only makes sense on web (redirects come back with a hash).
    detectSessionInUrl: Platform.OS === "web",
    // We use PKCE for OAuth on all platforms.
    flowType: "pkce",
  },
});

export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
