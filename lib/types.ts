export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  updatedAt: number;
};

export type Deck = {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: number;
  updatedAt: number;
};

export type AppData = {
  version: 1;
  decks: Deck[];
};
