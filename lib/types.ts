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

/** Inclusive; card is reinserted after this many *other* cards in the review queue. */
export type SpacingRange = { min: number; max: number };

export type StudySpacingSettings = {
  again: SpacingRange;
  hard: SpacingRange;
  good: SpacingRange;
  easy: SpacingRange;
};

export type AppData = {
  version: 2;
  decks: Deck[];
  studySpacing: StudySpacingSettings;
};
