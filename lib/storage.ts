import type { AppData, Deck, Flashcard, Grade, StudySpacingSettings } from "./types";

export const STORAGE_KEY = "card-flipper-v1";

export function defaultStudySpacing(): StudySpacingSettings {
  return {
    again: { min: 2, max: 5 },
    hard: { min: 8, max: 15 },
    good: { min: 20, max: 30 },
    easy: { min: 35, max: 50 },
  };
}

function normalizeRange(r: unknown, fallback: { min: number; max: number }): { min: number; max: number } {
  if (!r || typeof r !== "object") return { ...fallback };
  const o = r as Record<string, unknown>;
  const min = Math.max(0, Math.floor(Number(o.min) || fallback.min));
  const max = Math.max(0, Math.floor(Number(o.max) || fallback.max));
  if (min <= max) return { min, max };
  return { min: max, max: min };
}

export function normalizeStudySpacing(s: unknown): StudySpacingSettings {
  const d = defaultStudySpacing();
  if (!s || typeof s !== "object") return d;
  const o = s as Record<string, unknown>;
  return {
    again: normalizeRange(o.again, d.again),
    hard: normalizeRange(o.hard, d.hard),
    good: normalizeRange(o.good, d.good),
    easy: normalizeRange(o.easy, d.easy),
  };
}

export const emptyAppData: AppData = {
  version: 2,
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
        version: 2,
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
        version: 2,
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
