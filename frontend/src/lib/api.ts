import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const SESSION_TOKEN_KEY = "project-life-session-token";

async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(SESSION_TOKEN_KEY, "");
}

export async function setToken(token: string): Promise<void> {
  await storage.secureSet(SESSION_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage.secureRemove(SESSION_TOKEN_KEY);
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  createSession: (session_id: string) =>
    request<{ session_token: string; user: any }>("/auth/session", {
      method: "POST",
      body: { session_id },
      auth: false,
    }),
  me: () => request<any>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  updateProfile: (patch: Record<string, unknown>) =>
    request<any>("/profile", { method: "PUT", body: patch }),

  listPhases: () => request<any[]>("/phases"),
  advancePhase: () => request<any>("/phases/advance", { method: "POST" }),

  listJournal: () => request<any[]>("/journal"),
  createJournal: (body: Record<string, unknown>) =>
    request<any>("/journal", { method: "POST", body }),
  journalInsights: () => request<any>("/journal/insights"),

  listWeeklyCheckins: () => request<any[]>("/checkins/weekly"),
  createWeeklyCheckin: (body: Record<string, unknown>) =>
    request<any>("/checkins/weekly", { method: "POST", body }),

  todaySafetyCheckin: () => request<any>("/safety/checkin/today"),
  createSafetyCheckin: (body: Record<string, unknown>) =>
    request<any>("/safety/checkin", { method: "POST", body }),
  listContacts: () => request<any[]>("/safety/contacts"),
  createContact: (body: Record<string, unknown>) =>
    request<any>("/safety/contacts", { method: "POST", body }),
  deleteContact: (id: string) =>
    request<any>(`/safety/contacts/${id}`, { method: "DELETE" }),
  crisisResources: () => request<{ resources: any[] }>("/safety/crisis-resources"),

  listUploads: () => request<any[]>("/therapist-uploads"),
  createUpload: (body: Record<string, unknown>) =>
    request<any>("/therapist-uploads", { method: "POST", body }),

  listMemories: () => request<any[]>("/memories"),
  createMemory: (body: Record<string, unknown>) =>
    request<any>("/memories", { method: "POST", body }),

  listSessionLogs: () => request<any[]>("/session-logs"),
  createSessionLog: (body: Record<string, unknown>) =>
    request<any>("/session-logs", { method: "POST", body }),

  listPractices: () => request<any[]>("/somatic-practices"),

  listTimeline: () => request<any[]>("/timeline"),
  createTimeline: (body: Record<string, unknown>) =>
    request<any>("/timeline", { method: "POST", body }),

  dashboard: () => request<any>("/dashboard"),
  setStartingPhase: (phase: number) =>
    request<any>("/onboarding/starting-phase", { method: "POST", body: { phase } }),

  memoryPath: () => request<{ stones: any[] }>("/memory-path"),
  memoryStone: (id: string) => request<any>(`/memory-path/${id}`),
};
