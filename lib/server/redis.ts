import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

export function getRedisOrNull(): Redis | null {
  if (cached !== undefined) return cached;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    cached = null;
    return null;
  }
  try {
    cached = Redis.fromEnv();
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
