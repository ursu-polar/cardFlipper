import type { Grade, SpacingRange } from "./types";

/** Inclusive random integer. */
export function randomInt(min: number, max: number): number {
  const a = Math.min(min, max);
  const b = Math.max(min, max);
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Fisher–Yates shuffle of a copy. */
export function shuffleIds<T>(ids: T[]): T[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * `queue[0]` is the current card. Pops it, then reinserts it so that `k` other cards
 * come first, with `k` random in `range` (inclusive), or at the end if the queue is short.
 */
export function requeueAfterRange(queue: string[], range: SpacingRange, cardId: string): string[] {
  if (queue.length === 0) return [cardId];
  if (queue[0] !== cardId) return queue;
  const rest = queue.slice(1);
  const k = randomInt(range.min, range.max);
  const insertAt = Math.min(k, rest.length);
  return [...rest.slice(0, insertAt), cardId, ...rest.slice(insertAt)];
}

export type { Grade } from "./types";

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
