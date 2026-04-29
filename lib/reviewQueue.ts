import type { Grade } from "./types";

/** Fisher–Yates shuffle of a copy. */
export function shuffleIds<T>(ids: T[]): T[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

/** Map card id -> index in tie-break order (smaller = earlier). */
function orderRankMap(order: string[]): Map<string, number> {
  return new Map(order.map((id, i) => [id, i]));
}

/**
 * Among cards with dueAt <= now, pick the id with smallest dueAt; ties broken by
 * earlier position in `orderHint`.
 * Returns null if `cardIds` is empty.
 */
export function pickNextCardId(
  cardIds: string[],
  dueAt: Record<string, number>,
  now: number,
  orderHint: string[],
): string | null {
  if (cardIds.length === 0) return null;
  const rank = orderRankMap(orderHint);
  const ready = cardIds.filter((id) => (dueAt[id] ?? 0) <= now);
  if (ready.length === 0) return null;
  ready.sort((a, b) => {
    const da = dueAt[a] ?? 0;
    const db = dueAt[b] ?? 0;
    if (da !== db) return da - db;
    return (rank.get(a) ?? 999999) - (rank.get(b) ?? 999999);
  });
  return ready[0] ?? null;
}

/** Earliest due time among all card ids, or null if no cards. */
export function minDueTime(cardIds: string[], dueAt: Record<string, number>): number | null {
  if (cardIds.length === 0) return null;
  let m: number | null = null;
  for (const id of cardIds) {
    const t = dueAt[id] ?? 0;
    if (m === null || t < m) m = t;
  }
  return m;
}

/** How many cards have dueAt <= now. */
export function countDueNow(cardIds: string[], dueAt: Record<string, number>, now: number): number {
  return cardIds.filter((id) => (dueAt[id] ?? 0) <= now).length;
}

/** Human-readable short label for a delay (e.g. for grade buttons). */
export function formatIntervalShort(ms: number): string {
  if (ms < 0) return "0s";
  if (ms < 60_000) {
    const s = Math.max(1, Math.round(ms / 1000));
    return s === 1 ? "1s" : `${s}s`;
  }
  if (ms < 60 * 60_000) {
    const m = Math.round(ms / 60_000);
    return m === 1 ? "1 min" : `${m} min`;
  }
  if (ms < 24 * 60 * 60_000) {
    const h = Math.round(ms / (60 * 60_000));
    return h === 1 ? "1 h" : `${h} h`;
  }
  const d = Math.round(ms / (24 * 60 * 60_000));
  return d === 1 ? "1 day" : `${d} days`;
}

/** Shorter countdown for the “wait until next card” screen (refines every second in the UI). */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "a moment";
  if (ms < 60_000) return `${Math.max(1, Math.ceil(ms / 1000))}s`;
  if (ms < 60 * 60_000) return `${Math.ceil(ms / 60_000)} min`;
  if (ms < 24 * 60 * 60_000) {
    const t = Math.ceil(ms / 60_000);
    const mm = t % 60;
    const hh = Math.floor(t / 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
  }
  const days = Math.floor(ms / (24 * 60 * 60_000));
  const remH = Math.floor((ms % (24 * 60 * 60_000)) / (60 * 60_000));
  if (remH > 0) return `${days}d ${remH}h`;
  return `${days}d`;
}

export type { Grade, StudySpacingSettings } from "./types";

export function studyGradeLabel(g: Grade): string {
  switch (g) {
    case "again":
      return "Again";
    case "hard":
      return "Hard";
    case "good":
      return "Good";
    case "easy":
      return "Easy";
  }
}

/** Compact chip for last feedback in deck card lists. */
export function studyGradePillClass(g: Grade): string {
  const base = "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1";
  if (g === "again") return `${base} bg-red-950/45 text-red-200 ring-red-800/50`;
  if (g === "hard") return `${base} bg-orange-950/40 text-orange-200 ring-orange-800/50`;
  if (g === "good") return `${base} bg-lime-950/35 text-lime-200 ring-lime-800/45`;
  return `${base} bg-emerald-950/35 text-emerald-200 ring-emerald-800/45`;
}
