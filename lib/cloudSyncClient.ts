import type { AppData } from "@/lib/types";

export const SYNC_TOKEN_KEY = "card-flipper-sync-token";

const TOKEN_HEADER = "x-card-flipper-token";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function getOrCreateSyncToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SYNC_TOKEN_KEY);
    if (existing && isUuid(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SYNC_TOKEN_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export type CloudFetchResult =
  | { ok: true; data: AppData | null; cloudEnabled: boolean }
  | { ok: false; reason: "unavailable" | "bad-response"; cloudEnabled: false };

export async function fetchCloudAppData(token: string): Promise<CloudFetchResult> {
  if (!token) return { ok: false, reason: "unavailable", cloudEnabled: false };
  try {
    const res = await fetch("/api/data", {
      method: "GET",
      headers: { [TOKEN_HEADER]: token },
      cache: "no-store",
    });
    if (res.status === 503) {
      return { ok: false, reason: "unavailable", cloudEnabled: false };
    }
    if (!res.ok) {
      return { ok: false, reason: "bad-response", cloudEnabled: false };
    }
    const j = (await res.json()) as { ok?: boolean; data?: AppData | null };
    if (!j || j.ok !== true) {
      return { ok: false, reason: "bad-response", cloudEnabled: false };
    }
    return { ok: true, data: j.data ?? null, cloudEnabled: true };
  } catch {
    return { ok: false, reason: "unavailable", cloudEnabled: false };
  }
}

export async function putCloudAppData(token: string, data: AppData): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { [TOKEN_HEADER]: token, "content-type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
