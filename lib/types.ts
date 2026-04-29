export type Grade = "again" | "hard" | "good" | "easy";

export type Flashcard = {
  id: string;
  question: string;
  /** Shown together on the back; at least one string (empty strings are not stored). */
  answers: string[];
  updatedAt: number;
};

/** Snapshot after a review; `lastIntervalMs` is the delay just applied toward the next due date. */
export type CardSchedule = {
  nextDueAt: number;
  lastIntervalMs: number;
  ease: number;
};

export type Deck = {
  id: string;
  name: string;
  cards: Flashcard[];
  /** Card ids (unique) shown at least once in the current study run; persisted with the deck. */
  studySessionSeenIds?: string[];
  /** Latest study rating per card id (Again / Hard / Good / Easy). */
  cardLastStudyGrade?: Record<string, Grade>;
  /**
   * SM-2–style per-card state: when the card is due, last scheduled interval, ease factor.
   * Used for growing intervals (e.g. second Easy after 4d -> 8d). Keys = card ids.
   */
  cardSchedule?: Record<string, CardSchedule>;
  createdAt: number;
  updatedAt: number;
};

/** Per-grade delay in milliseconds before the card is due again (spaced repetition). */
export type StudySpacingSettings = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

export type AppData = {
  version: 4;
  decks: Deck[];
  studySpacing: StudySpacingSettings;
};
