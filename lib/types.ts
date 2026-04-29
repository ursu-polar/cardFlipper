export type Grade = "again" | "hard" | "good" | "easy";

export type Flashcard = {
  id: string;
  question: string;
  /** Shown together on the back; at least one string (empty strings are not stored). */
  answers: string[];
  updatedAt: number;
};

export type Deck = {
  id: string;
  name: string;
  cards: Flashcard[];
  /** Card ids (unique) shown at least once in the current study run; persisted with the deck. */
  studySessionSeenIds?: string[];
  /** Latest study rating per card id (Again / Hard / Good / Easy). */
  cardLastStudyGrade?: Record<string, Grade>;
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
  version: 3;
  decks: Deck[];
  studySpacing: StudySpacingSettings;
};
