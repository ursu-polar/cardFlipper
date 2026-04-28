"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { AppData, Deck, Flashcard } from "@/lib/types";
import {
  emptyAppData,
  loadAppData,
  newCard,
  newDeck,
  newId,
  saveAppData,
  STORAGE_KEY,
} from "@/lib/storage";

/**
 * `useSyncExternalStore` requires a stable `getSnapshot` and must not hydrate with a
 * different first client value than the server. The server has no `localStorage`, so
 * we return `getServerSnapshot()` until `subscribe` has run, then we read `localStorage`
 * and `getSnapshot` matches the stored data. We still cache the parsed object to avoid
 * a new `JSON.parse` on every re-render.
 */
let clientDataCache: AppData | null = null;
let hasClientSubscribed = false;

function getClientSnapshot(): AppData {
  if (typeof window === "undefined") return getServerSnapshot();
  if (!hasClientSubscribed) {
    return getServerSnapshot();
  }
  if (clientDataCache === null) {
    clientDataCache = loadAppData();
  }
  return clientDataCache;
}

function refreshFromStorage() {
  clientDataCache = loadAppData();
}

type Ctx = {
  data: AppData;
  setData: (updater: (prev: AppData) => AppData) => void;
  addDeck: (name: string) => Deck;
  updateDeck: (deckId: string, name: string) => void;
  removeDeck: (deckId: string) => void;
  addCard: (deckId: string, q: string, a: string) => Flashcard | null;
  updateCard: (deckId: string, cardId: string, q: string, a: string) => void;
  removeCard: (deckId: string, cardId: string) => void;
  importCards: (deckId: string, rows: { question: string; answer: string }[]) => number;
  moveDeck: (deckId: string, direction: "up" | "down") => void;
  moveCard: (deckId: string, cardId: string, direction: "up" | "down") => void;
};

const DecksContext = createContext<Ctx | null>(null);

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  hasClientSubscribed = true;
  refreshFromStorage();
  onStoreChange();

  const notify = () => {
    refreshFromStorage();
    onStoreChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("card-flipper-storage", notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("card-flipper-storage", notify);
  };
}

/** Server / pre-subscribe first paint — must match first client snapshot (see getClientSnapshot). */
function getServerSnapshot() {
  return emptyAppData;
}

export function DecksProvider({ children }: { children: React.ReactNode }) {
  const data = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const setData = useCallback((updater: (prev: AppData) => AppData) => {
    const next = updater(loadAppData());
    saveAppData(next);
  }, []);

  const addDeck = useCallback(
    (name: string) => {
      const deck = newDeck(name);
      setData((d) => ({ ...d, decks: [deck, ...d.decks] }));
      return deck;
    },
    [setData],
  );

  const updateDeck = useCallback(
    (deckId: string, name: string) => {
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) =>
          x.id === deckId
            ? { ...x, name: name.trim() || "Untitled deck", updatedAt: t }
            : x,
        ),
      }));
    },
    [setData],
  );

  const removeDeck = useCallback(
    (deckId: string) => {
      setData((d) => ({ ...d, decks: d.decks.filter((x) => x.id !== deckId) }));
    },
    [setData],
  );

  const addCard = useCallback(
    (deckId: string, q: string, a: string) => {
      if (!q.trim() && !a.trim()) return null;
      const card = newCard(q, a);
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          return { ...x, cards: [card, ...x.cards], updatedAt: t };
        }),
      }));
      return card;
    },
    [setData],
  );

  const updateCard = useCallback(
    (deckId: string, cardId: string, q: string, a: string) => {
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          return {
            ...x,
            updatedAt: t,
            cards: x.cards.map((c) =>
              c.id === cardId
                ? { ...c, question: q.trim(), answer: a.trim(), updatedAt: t }
                : c,
            ),
          };
        }),
      }));
    },
    [setData],
  );

  const removeCard = useCallback(
    (deckId: string, cardId: string) => {
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          return {
            ...x,
            updatedAt: t,
            cards: x.cards.filter((c) => c.id !== cardId),
          };
        }),
      }));
    },
    [setData],
  );

  const importCards = useCallback(
    (deckId: string, rows: { question: string; answer: string }[]) => {
      const t = Date.now();
      const nextCards: Flashcard[] = rows.map((r) => ({
        id: newId(),
        question: r.question,
        answer: r.answer,
        updatedAt: t,
      }));
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          return { ...x, updatedAt: t, cards: [...x.cards, ...nextCards] };
        }),
      }));
      return nextCards.length;
    },
    [setData],
  );

  const moveDeck = useCallback(
    (deckId: string, direction: "up" | "down") => {
      setData((d) => {
        const i = d.decks.findIndex((x) => x.id === deckId);
        if (i < 0) return d;
        const j = direction === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= d.decks.length) return d;
        const next = [...d.decks];
        [next[i], next[j]] = [next[j]!, next[i]!];
        return { ...d, decks: next };
      });
    },
    [setData],
  );

  const moveCard = useCallback(
    (deckId: string, cardId: string, direction: "up" | "down") => {
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          const i = x.cards.findIndex((c) => c.id === cardId);
          if (i < 0) return x;
          const j = direction === "up" ? i - 1 : i + 1;
          if (j < 0 || j >= x.cards.length) return x;
          const cards = [...x.cards];
          [cards[i], cards[j]] = [cards[j]!, cards[i]!];
          return { ...x, cards, updatedAt: t };
        }),
      }));
    },
    [setData],
  );

  const value = useMemo(
    () => ({
      data,
      setData,
      addDeck,
      updateDeck,
      removeDeck,
      addCard,
      updateCard,
      removeCard,
      importCards,
      moveDeck,
      moveCard,
    }),
    [
      data,
      setData,
      addDeck,
      updateDeck,
      removeDeck,
      addCard,
      updateCard,
      removeCard,
      importCards,
      moveDeck,
      moveCard,
    ],
  );

  return <DecksContext.Provider value={value}>{children}</DecksContext.Provider>;
}

export function useDecks() {
  const c = useContext(DecksContext);
  if (!c) throw new Error("useDecks must be used under DecksProvider");
  return c;
}
