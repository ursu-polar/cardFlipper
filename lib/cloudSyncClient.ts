import type { AppData } from "@/lib/types";

const AUTH = "Authorization";

export type CloudFetchResult =
  | { ok: true; data: AppData | null; cloudEnabled: boolean }
  | { ok: false; reason: "unavailable" | "bad-response" | "unauthorized"; cloudEnabled: false };

export async function fetchCloudAppData(sessionToken: string): Promise<CloudFetchResult> {
  if (!sessionToken) {
    return { ok: false, reason: "unauthorized", cloudEnabled: false };
  }
  try {
    const res = await fetch("/api/data", {
      method: "GET",
      headers: { [AUTH]: `Bearer ${sessionToken}` },
      cache: "no-store",
    });
    if (res.status === 401) {
      return { ok: false, reason: "unauthorized", cloudEnabled: false };
    }
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

export async function putCloudAppData(sessionToken: string, data: AppData): Promise<boolean> {
  if (!sessionToken) return false;
  try {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: {
        [AUTH]: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
