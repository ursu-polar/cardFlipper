import type { AppData, Deck, Flashcard, Grade, StudySpacingSettings } from "./types";

export const STORAGE_KEY = "card-flipper-v1";

const MS_DAY = 24 * 60 * 60 * 1000;
/** Reject pathological or corrupted values; allow 0 (immediate) up to 1 year. */
export const MAX_STUDY_DELAY_MS = 365 * MS_DAY;

export function defaultStudySpacing(): StudySpacingSettings {
  return {
    again: 60_000, // 1 min
    hard: 8 * 60_000, // 8 min
    good: 15 * 60_000, // 15 min
    easy: 4 * MS_DAY, // 4 days
  };
}

function isLegacySpacingRange(x: unknown): x is { min: number; max: number } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return "min" in o && "max" in o;
}

function normalizeDelayMs(x: unknown, fallback: number): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > MAX_STUDY_DELAY_MS) return MAX_STUDY_DELAY_MS;
  return Math.floor(n);
}

export function normalizeStudySpacing(s: unknown): StudySpacingSettings {
  const d = defaultStudySpacing();
  if (!s || typeof s !== "object") return d;
  const o = s as Record<string, unknown>;
  if (
    isLegacySpacingRange(o.again) ||
    isLegacySpacingRange(o.hard) ||
    isLegacySpacingRange(o.good) ||
    isLegacySpacingRange(o.easy)
  ) {
    return { ...d };
  }
  return {
    again: normalizeDelayMs(o.again, d.again),
    hard: normalizeDelayMs(o.hard, d.hard),
    good: normalizeDelayMs(o.good, d.good),
    easy: normalizeDelayMs(o.easy, d.easy),
  };
}

export const emptyAppData: AppData = {
  version: 3,
  decks: [],
  studySpacing: defaultStudySpacing(),
};

const GRADES: Set<string> = new Set(["again", "hard", "good", "easy"]);

function filterCardLastGradesToDeck(
  raw: unknown,
  validIds: Set<string>,
): Record<string, Grade> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, Grade> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(k) || typeof v !== "string" || !GRADES.has(v)) continue;
    out[k] = v as Grade;
  }
  return Object.keys(out).length ? out : undefined;
}

function filterSeenIdsToDeck(seen: unknown, validIds: Set<string>): string[] | undefined {
  if (!Array.isArray(seen)) return undefined;
  const out: string[] = [];
  const used = new Set<string>();
  for (const id of seen) {
    if (typeof id !== "string" || !validIds.has(id) || used.has(id)) continue;
    used.add(id);
    out.push(id);
  }
  return out.length ? out : undefined;
}

/** Migrates legacy `answer: string` to `answers: string[]`. */
export function normalizeFlashcard(raw: unknown): Flashcard {
  if (!raw || typeof raw !== "object") {
    return { id: newId(), question: "?", answers: ["—"], updatedAt: Date.now() };
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : newId();
  const question = String(o.question ?? "");
  const updatedAt = typeof o.updatedAt === "number" ? o.updatedAt : Date.now();
  if (Array.isArray(o.answers) && o.answers.length > 0) {
    const answers = o.answers
      .filter((x): x is string => typeof x === "string")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    if (answers.length > 0) {
      return { id, question, answers, updatedAt };
    }
  }
  const legacy = String((o as { answer?: unknown }).answer ?? "").trim();
  if (legacy) {
    return { id, question, answers: [legacy], updatedAt };
  }
  return { id, question, answers: ["—"], updatedAt };
}

function mapDeckWithNormalizedCards(deck: Deck): Deck {
  return {
    ...deck,
    cards: deck.cards.map((c) => normalizeFlashcard(c)),
  };
}

function parseJSON(raw: string | null): AppData {
  if (!raw) return emptyAppData;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return emptyAppData;
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.decks)) return emptyAppData;

    if (o.version === 1) {
      const decks = (o.decks as Deck[]).map((deck) => {
        const withCards = mapDeckWithNormalizedCards(deck);
        const valid = new Set(withCards.cards.map((c) => c.id));
        return {
          ...withCards,
          studySessionSeenIds: filterSeenIdsToDeck(
            (deck as Deck).studySessionSeenIds,
            valid,
          ),
          cardLastStudyGrade: filterCardLastGradesToDeck(
            (deck as Deck).cardLastStudyGrade,
            valid,
          ),
        };
      });
      return {
        version: 3,
        decks,
        studySpacing: defaultStudySpacing(),
      };
    }
    if (o.version === 2) {
      const decks = (o.decks as Deck[]).map((deck) => {
        const withCards = mapDeckWithNormalizedCards(deck);
        const valid = new Set(withCards.cards.map((c) => c.id));
        return {
          ...withCards,
          studySessionSeenIds: filterSeenIdsToDeck(deck.studySessionSeenIds, valid),
          cardLastStudyGrade: filterCardLastGradesToDeck(deck.cardLastStudyGrade, valid),
        };
      });
      return {
        version: 3,
        decks,
        studySpacing: normalizeStudySpacing(o.studySpacing),
      };
    }
    if (o.version === 3) {
      const decks = (o.decks as Deck[]).map((deck) => {
        const withCards = mapDeckWithNormalizedCards(deck);
        const valid = new Set(withCards.cards.map((c) => c.id));
        return {
          ...withCards,
          studySessionSeenIds: filterSeenIdsToDeck(deck.studySessionSeenIds, valid),
          cardLastStudyGrade: filterCardLastGradesToDeck(deck.cardLastStudyGrade, valid),
        };
      });
      return {
        version: 3,
        decks,
        studySpacing: normalizeStudySpacing(o.studySpacing),
      };
    }
  } catch {
    /* ignore */
  }
  return emptyAppData;
}

/** Exposed for the `/api/data` route to validate a JSON body the same way as the browser. */
export function parseAppDataFromJsonString(raw: string | null): AppData {
  return parseJSON(raw);
}

export function loadAppData(): AppData {
  if (typeof window === "undefined") return emptyAppData;
  return parseJSON(localStorage.getItem(STORAGE_KEY) ?? null);
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("card-flipper-storage"));
}

/** localStorage cache for the signed-in user (keyed by server user id). */
export function userDataStorageKey(userId: string): string {
  return `${STORAGE_KEY}:u:${userId}`;
}

export function loadAppDataForUser(userId: string): AppData {
  if (typeof window === "undefined") return emptyAppData;
  return parseAppDataFromJsonString(localStorage.getItem(userDataStorageKey(userId)));
}

export function saveAppDataForUser(userId: string, data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userDataStorageKey(userId), JSON.stringify(data));
  window.dispatchEvent(new Event("card-flipper-storage"));
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function newDeck(name: string): Deck {
  const t = Date.now();
  return { id: newId(), name: name.trim() || "Untitled deck", cards: [], createdAt: t, updatedAt: t };
}

export function newCard(question: string, answers: string[]): Flashcard {
  const t = Date.now();
  const list = answers.map((a) => a.trim()).filter((a) => a.length > 0);
  return {
    id: newId(),
    question: question.trim(),
    answers: list.length > 0 ? list : ["—"],
    updatedAt: t,
  };
}
