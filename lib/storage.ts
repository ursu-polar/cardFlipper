import type { AppData, Deck, Flashcard } from "./types";

export const STORAGE_KEY = "card-flipper-v1";

export const emptyAppData: AppData = { version: 1, decks: [] };

function parseJSON(raw: string | null): AppData {
  if (!raw) return emptyAppData;
  try {
    const v = JSON.parse(raw) as AppData;
    if (v?.version === 1 && Array.isArray(v.decks)) return v;
  } catch {
    /* ignore */
  }
  return emptyAppData;
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

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function newDeck(name: string): Deck {
  const t = Date.now();
  return { id: newId(), name: name.trim() || "Untitled deck", cards: [], createdAt: t, updatedAt: t };
}

export function newCard(question: string, answer: string): Flashcard {
  const t = Date.now();
  return { id: newId(), question: question.trim(), answer: answer.trim(), updatedAt: t };
}
