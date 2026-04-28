"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchCloudAppData, putCloudAppData } from "@/lib/cloudSyncClient";
import { SAMPLE_CARDS_TEST2, SAMPLE_TEST2_SEED_KEY } from "@/lib/sampleCardsTest2";
import type { AppData, Deck, Flashcard, Grade, StudySpacingSettings } from "@/lib/types";
import {
  emptyAppData,
  loadAppDataForUser,
  newCard,
  newDeck,
  newId,
  normalizeStudySpacing,
  parseAppDataFromJsonString,
  saveAppDataForUser,
  userDataStorageKey,
} from "@/lib/storage";

type Ctx = {
  data: AppData;
  setData: (updater: (prev: AppData) => AppData) => void;
  /** True when Upstash is configured and this browser’s data is synced to the server. */
  cloudSyncEnabled: boolean;
  addDeck: (name: string) => Deck;
  updateDeck: (deckId: string, name: string) => void;
  removeDeck: (deckId: string) => void;
  addCard: (deckId: string, q: string, answers: string[]) => Flashcard | null;
  updateCard: (deckId: string, cardId: string, q: string, answers: string[]) => void;
  removeCard: (deckId: string, cardId: string) => void;
  importCards: (deckId: string, rows: { question: string; answers: string[] }[]) => number;
  reorderDecks: (orderedDeckIds: string[]) => void;
  reorderCards: (deckId: string, orderedCardIds: string[]) => void;
  updateStudySpacing: (s: StudySpacingSettings) => void;
  appendStudySessionSeen: (deckId: string, cardId: string) => void;
  clearStudySessionSeen: (deckId: string) => void;
  recordCardStudyGrade: (deckId: string, cardId: string, grade: Grade) => void;
};

const DecksContext = createContext<Ctx | null>(null);

export function DecksProvider({
  userId,
  sessionToken,
  children,
}: {
  userId: string;
  sessionToken: string;
  children: React.ReactNode;
}) {
  const [data, setDataState] = useState<AppData>(emptyAppData);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const cloudRef = useRef(false);
  const tokenRef = useRef(sessionToken);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when the user changes data (not during initial layout / cloud init). */
  const localDirtyRef = useRef(false);

  useEffect(() => {
    tokenRef.current = sessionToken;
  }, [sessionToken]);

  const scheduleCloudSave = useCallback((next: AppData) => {
    if (!cloudRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const t = tokenRef.current;
      if (t) void putCloudAppData(t, next);
    }, 450);
  }, []);

  const setData = useCallback(
    (updater: (prev: AppData) => AppData) => {
      localDirtyRef.current = true;
      setDataState((prev) => {
        const next = updater(prev);
        saveAppDataForUser(userId, next);
        scheduleCloudSave(next);
        return next;
      });
    },
    [scheduleCloudSave, userId],
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    setDataState(loadAppDataForUser(userId));
    localDirtyRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !sessionToken) {
      cloudRef.current = false;
      setCloudSyncEnabled(false);
      return;
    }
    tokenRef.current = sessionToken;
    let cancelled = false;
    (async () => {
      const r = await fetchCloudAppData(sessionToken);
      if (cancelled) return;
      if (!r.ok) {
        cloudRef.current = false;
        setCloudSyncEnabled(false);
        return;
      }
      if (r.data != null) {
        if (localDirtyRef.current) {
          const fresh = loadAppDataForUser(userId);
          void putCloudAppData(sessionToken, fresh);
        } else {
          setDataState(r.data);
          saveAppDataForUser(userId, r.data);
        }
        cloudRef.current = true;
        setCloudSyncEnabled(true);
        return;
      }
      const local = loadAppDataForUser(userId);
      if (local.decks.length > 0) {
        const ok = await putCloudAppData(sessionToken, local);
        if (cancelled) return;
        cloudRef.current = ok;
        setCloudSyncEnabled(ok);
        return;
      }
      cloudRef.current = true;
      setCloudSyncEnabled(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, sessionToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const k = userDataStorageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== k || e.newValue == null) return;
      try {
        setDataState(parseAppDataFromJsonString(e.newValue));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

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
    (deckId: string, q: string, answers: string[]) => {
      const list = answers.map((a) => a.trim()).filter((a) => a.length > 0);
      if (list.length === 0) return null;
      const card = newCard(q, list);
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
    (deckId: string, cardId: string, q: string, answers: string[]) => {
      const t = Date.now();
      const list = answers.map((a) => a.trim()).filter((a) => a.length > 0);
      if (list.length === 0) return;
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          return {
            ...x,
            updatedAt: t,
            cards: x.cards.map((c) =>
              c.id === cardId
                ? { ...c, question: q.trim(), answers: list, updatedAt: t }
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
          const nextSeen = (x.studySessionSeenIds ?? []).filter((id) => id !== cardId);
          const nextGrades = { ...x.cardLastStudyGrade };
          delete nextGrades[cardId];
          return {
            ...x,
            updatedAt: t,
            cards: x.cards.filter((c) => c.id !== cardId),
            studySessionSeenIds: nextSeen.length ? nextSeen : undefined,
            cardLastStudyGrade: Object.keys(nextGrades).length ? nextGrades : undefined,
          };
        }),
      }));
    },
    [setData],
  );

  const importCards = useCallback(
    (deckId: string, rows: { question: string; answers: string[] }[]) => {
      const t = Date.now();
      const nextCards: Flashcard[] = rows.map((r) => ({
        id: newId(),
        question: r.question,
        answers: r.answers,
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

  const reorderDecks = useCallback(
    (orderedDeckIds: string[]) => {
      setData((d) => {
        if (orderedDeckIds.length !== d.decks.length) return d;
        const byId = new Map(d.decks.map((x) => [x.id, x]));
        if (!orderedDeckIds.every((id) => byId.has(id))) return d;
        return { ...d, decks: orderedDeckIds.map((id) => byId.get(id)!) };
      });
    },
    [setData],
  );

  const reorderCards = useCallback(
    (deckId: string, orderedCardIds: string[]) => {
      const t = Date.now();
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          if (orderedCardIds.length !== x.cards.length) return x;
          const byId = new Map(x.cards.map((c) => [c.id, c]));
          if (!orderedCardIds.every((id) => byId.has(id))) return x;
          return {
            ...x,
            updatedAt: t,
            cards: orderedCardIds.map((id) => byId.get(id)!),
          };
        }),
      }));
    },
    [setData],
  );

  const updateStudySpacing = useCallback(
    (s: StudySpacingSettings) => {
      setData((d) => ({ ...d, studySpacing: normalizeStudySpacing(s) }));
    },
    [setData],
  );

  const appendStudySessionSeen = useCallback(
    (deckId: string, cardId: string) => {
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          const valid = new Set(x.cards.map((c) => c.id));
          if (!valid.has(cardId)) return x;
          const prev = x.studySessionSeenIds ?? [];
          if (prev.includes(cardId)) return x;
          return {
            ...x,
            updatedAt: Date.now(),
            studySessionSeenIds: [...prev, cardId],
          };
        }),
      }));
    },
    [setData],
  );

  const clearStudySessionSeen = useCallback(
    (deckId: string) => {
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) =>
          x.id === deckId
            ? { ...x, studySessionSeenIds: undefined, updatedAt: Date.now() }
            : x,
        ),
      }));
    },
    [setData],
  );

  const recordCardStudyGrade = useCallback(
    (deckId: string, cardId: string, grade: Grade) => {
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => {
          if (x.id !== deckId) return x;
          if (!x.cards.some((c) => c.id === cardId)) return x;
          return {
            ...x,
            updatedAt: Date.now(),
            cardLastStudyGrade: { ...x.cardLastStudyGrade, [cardId]: grade },
          };
        }),
      }));
    },
    [setData],
  );

  /** Dev-only: once per user, append sample cards to a deck named "test2". */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const perUserKey = `${SAMPLE_TEST2_SEED_KEY}:${userId}`;
    if (localStorage.getItem(perUserKey) === "1") {
      return;
    }
    const d = loadAppDataForUser(userId);
    const test2 = d.decks.find((x) => x.name.trim().toLowerCase() === "test2");
    const test2Rows = SAMPLE_CARDS_TEST2.map((r) => ({
      question: r.question,
      answers: [r.answer],
    }));
    if (test2) {
      importCards(test2.id, test2Rows);
    } else {
      const created = addDeck("test2");
      importCards(created.id, test2Rows);
    }
    localStorage.setItem(perUserKey, "1");
  }, [addDeck, importCards, userId]);

  const value = useMemo(
    () => ({
      data,
      setData,
      cloudSyncEnabled,
      addDeck,
      updateDeck,
      removeDeck,
      addCard,
      updateCard,
      removeCard,
      importCards,
      reorderDecks,
      reorderCards,
      updateStudySpacing,
      appendStudySessionSeen,
      clearStudySessionSeen,
      recordCardStudyGrade,
    }),
    [
      data,
      setData,
      cloudSyncEnabled,
      addDeck,
      updateDeck,
      removeDeck,
      addCard,
      updateCard,
      removeCard,
      importCards,
      reorderDecks,
      reorderCards,
      updateStudySpacing,
      appendStudySessionSeen,
      clearStudySessionSeen,
      recordCardStudyGrade,
    ],
  );

  return <DecksContext.Provider value={value}>{children}</DecksContext.Provider>;
}

export function useDecks() {
  const c = useContext(DecksContext);
  if (!c) throw new Error("useDecks must be used under DecksProvider");
  return c;
}
