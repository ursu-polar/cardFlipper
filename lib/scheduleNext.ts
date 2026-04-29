import { MAX_STUDY_DELAY_MS } from "./storage";
import type { CardSchedule, Grade, StudySpacingSettings } from "./types";

/**
 * SM-2–inspired 4-button scheduling. Settings supply floor delays for each grade; repeated
 * successes grow `lastIntervalMs` (Good: I' = I × ease; Easy after "mature" interval: double I).
 * See computeNextSchedule body for exact rules.
 */
export const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 2.5;

function clampEase(e: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, e));
}

function clampIntervalMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(MAX_STUDY_DELAY_MS, Math.max(0, Math.floor(ms)));
}

/**
 * After rating `grade` at time `now`, return the new delay and stored schedule fields.
 * `previous` is the card’s saved state before this answer (null = never studied).
 */
export function computeNextSchedule(
  grade: Grade,
  previous: CardSchedule | null,
  settings: StudySpacingSettings,
  now: number,
): { intervalMs: number; lastIntervalMs: number; ease: number; nextDueAt: number } {
  const s = settings;

  if (previous == null) {
    const intervalMs = clampIntervalMs(s[grade]);
    let ease = DEFAULT_EASE;
    if (grade === "again") ease = clampEase(DEFAULT_EASE - 0.2);
    if (grade === "hard") ease = clampEase(DEFAULT_EASE - 0.15);
    if (grade === "easy") ease = Math.min(MAX_EASE, DEFAULT_EASE + 0.05);
    return {
      intervalMs,
      lastIntervalMs: intervalMs,
      ease,
      nextDueAt: now + intervalMs,
    };
  }

  const last = previous.lastIntervalMs;
  const prevEase = previous.ease;

  if (grade === "again") {
    const intervalMs = clampIntervalMs(s.again);
    return {
      intervalMs,
      lastIntervalMs: intervalMs,
      ease: clampEase(prevEase - 0.2),
      nextDueAt: now + intervalMs,
    };
  }

  if (grade === "hard") {
    const raw = last * 0.5 * (prevEase / DEFAULT_EASE);
    const intervalMs = clampIntervalMs(Math.max(s.hard, raw));
    return {
      intervalMs,
      lastIntervalMs: intervalMs,
      ease: clampEase(prevEase - 0.15),
      nextDueAt: now + intervalMs,
    };
  }

  if (grade === "good") {
    const raw = last * prevEase;
    const intervalMs = clampIntervalMs(Math.max(s.good, raw));
    return {
      intervalMs,
      lastIntervalMs: intervalMs,
      ease: prevEase,
      nextDueAt: now + intervalMs,
    };
  }

  // Easy: if last interval is already at least the "easy" floor, double (second Easy after 4d -> 8d);
  // otherwise keep growing (learning phase) without forcing the full 4d floor on every step.
  const easyFloor = s.easy;
  const mature = last >= easyFloor;
  const raw = mature ? last * 2 : last * prevEase * 1.2;
  const intervalMs = clampIntervalMs(Math.max(easyFloor, raw));
  return {
    intervalMs,
    lastIntervalMs: intervalMs,
    ease: Math.min(MAX_EASE, prevEase + 0.1),
    nextDueAt: now + intervalMs,
  };
}

export function toCardSchedule(next: {
  intervalMs: number;
  lastIntervalMs: number;
  ease: number;
  nextDueAt: number;
}): CardSchedule {
  return {
    nextDueAt: next.nextDueAt,
    lastIntervalMs: next.lastIntervalMs,
    ease: next.ease,
  };
}
