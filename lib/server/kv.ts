import { Redis } from "@upstash/redis";

/**
 * Minimal async KV used by auth and deck APIs.
 * Uses Upstash Redis when env vars are set; otherwise an in-process memory store (demo / local only).
 */
export type AppKv = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string, opts?: { ex?: number }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

let memoryFallbackWarned = false;

let memorySingleton: AppKv | null = null;

function createMemoryKv(): AppKv {
  type Row = { val: string; expAt?: number };
  const m = new Map<string, Row>();

  function sweep() {
    const now = Date.now();
    for (const [k, row] of m) {
      if (row.expAt != null && now > row.expAt) m.delete(k);
    }
  }

  return {
    async get(key: string) {
      sweep();
      const row = m.get(key);
      if (!row) return null;
      if (row.expAt != null && Date.now() > row.expAt) {
        m.delete(key);
        return null;
      }
      return row.val;
    },
    async set(key: string, value: string, opts?: { ex?: number }) {
      const expAt = opts?.ex != null ? Date.now() + opts.ex * 1000 : undefined;
      m.set(key, { val: value, expAt });
      return "OK";
    },
    async del(key: string) {
      m.delete(key);
      return 1;
    },
  };
}

/**
 * Tries all common Upstash / Vercel env names (integrations sometimes use different names).
 */
export function resolveUpstashEnv(): { url: string; token: string; source: string } | null {
  const upUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const upTok = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (upUrl && upTok) {
    return { url: upUrl, token: upTok, source: "UPSTASH_REDIS_REST_*" };
  }
  const kvUrl = process.env.KV_REST_API_URL?.trim() ?? "";
  const kvTok = process.env.KV_REST_API_TOKEN?.trim() ?? "";
  if (kvUrl && kvTok) {
    return { url: kvUrl, token: kvTok, source: "KV_REST_API_*" };
  }
  return null;
}

let cached: AppKv | null | undefined;

/**
 * Returns a working KV: Upstash if configured, otherwise a shared in-memory store.
 * The memory store is fine for `npm run dev` and small single-instance demos; on Vercel, use Upstash for real persistence.
 */
export function getAppKv(): AppKv {
  if (cached !== undefined) return cached!;

  const up = resolveUpstashEnv();
  if (up) {
    try {
      const redis = new Redis({ url: up.url, token: up.token });
      if (process.env.NODE_ENV === "development") {
        console.info(`[card-flipper] Upstash connected (${up.source})`);
      }
      cached = {
        get: (k) => redis.get(k) as Promise<unknown>,
        set: (k, v, o) =>
          o?.ex != null
            ? (redis.set(k, v, { ex: o.ex }) as Promise<unknown>)
            : (redis.set(k, v) as Promise<unknown>),
        del: (k) => redis.del(k) as Promise<unknown>,
      };
      return cached;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[card-flipper] Upstash init failed, using memory", e);
      }
    }
  }

  if (!memorySingleton) memorySingleton = createMemoryKv();
  cached = memorySingleton;
  if (!memoryFallbackWarned) {
    memoryFallbackWarned = true;
    console.warn(
      "[card-flipper] No Upstash Redis env vars (or they failed to connect). Using in-memory storage — data is lost on server restart. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel → Settings → Environment Variables, then redeploy. " +
        "Create a database: Vercel dashboard → your project → Storage → Create / Connect Redis (Upstash).",
    );
  }
  return cached;
}

/**
 * @deprecated use getAppKv() — it always returns a store.
 */
export function getRedisOrNull(): AppKv {
  return getAppKv();
}
