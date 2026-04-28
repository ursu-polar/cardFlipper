"use client";

import { useDecks } from "@/components/DecksContext";
import { FlipCard } from "@/components/FlipCard";
import { parseCardCSV } from "@/lib/csv";
import type { Flashcard } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type View =
  | { name: "decks" }
  | { name: "manage"; deckId: string }
  | { name: "study"; deckId: string };

export function CardApp() {
  const {
    data,
    addDeck,
    updateDeck,
    removeDeck,
    addCard,
    updateCard,
    removeCard,
    importCards,
    moveDeck,
    moveCard,
  } = useDecks();
  const [view, setView] = useState<View>({ name: "decks" });
  const [newDeckName, setNewDeckName] = useState("");

  const deck = useMemo(
    () => (view.name === "decks" ? null : data.decks.find((d) => d.id === view.deckId) ?? null),
    [data.decks, view],
  );

  if (view.name !== "decks" && !deck) {
    return <MissingDeck onBack={() => setView({ name: "decks" })} />;
  }

  if (view.name === "manage" && deck) {
    return (
      <ManageDeck
        deck={deck}
        onBack={() => setView({ name: "decks" })}
        onStudy={() => setView({ name: "study", deckId: deck.id })}
        onRename={(name) => updateDeck(deck.id, name)}
        onDelete={() => {
          removeDeck(deck.id);
          setView({ name: "decks" });
        }}
        onAddCard={(q, a) => addCard(deck.id, q, a)}
        onUpdateCard={(id, q, a) => updateCard(deck.id, id, q, a)}
        onRemoveCard={(id) => removeCard(deck.id, id)}
        onImportCSV={(rows) => importCards(deck.id, rows)}
        onMoveCard={(cardId, dir) => moveCard(deck.id, cardId, dir)}
      />
    );
  }

  if (view.name === "study" && deck) {
    return (
      <StudyDeck
        deck={deck}
        onUpdateCard={(cardId, q, a) => updateCard(deck.id, cardId, q, a)}
        onBack={() => setView({ name: "manage", deckId: deck.id })}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Card Flipper</h1>
        <p className="mt-2 text-slate-600">Decks live in this browser (local storage).</p>
      </header>

      <form
        className="mb-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const d = addDeck(newDeckName);
          setNewDeckName("");
          setView({ name: "manage", deckId: d.id });
        }}
      >
        <input
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="New deck name"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Create deck
        </button>
      </form>

      <ul className="space-y-3">
        {data.decks.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-slate-500">
            No decks yet. Add a name above and create your first deck.
          </li>
        )}
        {data.decks.map((d, deckIndex) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
          >
            <ReorderArrows
              label={`Reorder deck: ${d.name}`}
              disableUp={deckIndex === 0}
              disableDown={deckIndex === data.decks.length - 1}
              onMoveUp={() => moveDeck(d.id, "up")}
              onMoveDown={() => moveDeck(d.id, "down")}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{d.name}</p>
              <p className="text-sm text-slate-500">
                {d.cards.length} {d.cards.length === 1 ? "card" : "cards"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setView({ name: "study", deckId: d.id })}
              >
                Study
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => setView({ name: "manage", deckId: d.id })}
              >
                Manage
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReorderArrows({
  label,
  disableUp,
  disableDown,
  onMoveUp,
  onMoveDown,
}: {
  label: string;
  disableUp: boolean;
  disableDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className="flex shrink-0 flex-col gap-0.5"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        title="Move up"
        disabled={disableUp}
        onClick={onMoveUp}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
      >
        ↑
      </button>
      <button
        type="button"
        title="Move down"
        disabled={disableDown}
        onClick={onMoveDown}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
      >
        ↓
      </button>
    </div>
  );
}

function MissingDeck({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-slate-600">This deck was removed or is missing.</p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
        onClick={onBack}
      >
        Back to decks
      </button>
    </div>
  );
}

function ManageDeck({
  deck,
  onBack,
  onStudy,
  onRename,
  onDelete,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onImportCSV,
  onMoveCard,
}: {
  deck: { id: string; name: string; cards: Flashcard[] };
  onBack: () => void;
  onStudy: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddCard: (q: string, a: string) => void;
  onUpdateCard: (id: string, q: string, a: string) => void;
  onRemoveCard: (id: string) => void;
  onImportCSV: (rows: { question: string; answer: string }[]) => number;
  onMoveCard: (cardId: string, direction: "up" | "down") => void;
}) {
  const [title, setTitle] = useState(deck.name);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvOk, setCsvOk] = useState<string | null>(null);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");

  useEffect(() => {
    setTitle(deck.name);
  }, [deck.name]);

  const runImport = useCallback(
    (text: string) => {
      setCsvError(null);
      setCsvOk(null);
      const r = parseCardCSV(text);
      if (!r.ok) {
        setCsvError(r.error);
        return;
      }
      const n = onImportCSV(r.rows);
      const w = r.warnings.length ? ` ${r.warnings.join(" ")}` : "";
      setCsvOk(`Imported ${n} card(s).${w}`);
      setCsvText("");
    },
    [onImportCSV],
  );

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Decks
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={onStudy}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Study
        </button>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase text-slate-500">Deck name</label>
          <input
            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => onRename(title)}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this deck and all its cards?")) onDelete();
          }}
          className="self-start rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
        >
          Delete deck
        </button>
      </div>

      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add card</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddCard(q, a);
            setQ("");
            setA("");
          }}
        >
          <div>
            <label className="text-xs text-slate-500">Question</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
              rows={3}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Answer</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
              rows={3}
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add card
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Import from CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Two columns: <code className="rounded bg-slate-100 px-1">question,answer</code> or{" "}
          <code className="rounded bg-slate-100 px-1">front,back</code> (include a header row, or
          paste raw rows).
        </p>
        <div className="mt-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const text = await file.text();
              runImport(text);
            }}
          />
        </div>
        <textarea
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
          rows={5}
          placeholder='question,answer&#10;What is 2+2?,4'
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
            onClick={() => runImport(csvText)}
          >
            Import from text
          </button>
          {csvError && <p className="text-sm text-red-600">{csvError}</p>}
          {csvOk && <p className="text-sm text-green-700">{csvOk}</p>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Cards ({deck.cards.length})</h2>
        <ul className="mt-3 space-y-2">
          {deck.cards.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-slate-500">
              No cards. Add one above or import CSV.
            </li>
          )}
          {deck.cards.map((c, cardIndex) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-2 pr-3"
            >
              <ReorderArrows
                label={`Reorder card: ${(c.question || "Card").slice(0, 40)}`}
                disableUp={cardIndex === 0}
                disableDown={cardIndex === deck.cards.length - 1}
                onMoveUp={() => onMoveCard(c.id, "up")}
                onMoveDown={() => onMoveCard(c.id, "down")}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{c.question || "—"}</p>
                <p className="truncate text-sm text-slate-600">{c.answer || "—"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    setEditing(c);
                    setEditQ(c.question);
                    setEditA(c.answer);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => onRemoveCard(c.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Edit card</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-slate-500">Question</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Answer</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={editA}
                  onChange={(e) => setEditA(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  onUpdateCard(editing.id, editQ, editA);
                  setEditing(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudyDeck({
  deck,
  onBack,
  onUpdateCard,
}: {
  deck: { name: string; cards: Flashcard[] };
  onBack: () => void;
  onUpdateCard: (cardId: string, q: string, a: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const total = deck.cards.length;

  useEffect(() => {
    if (total === 0) return;
    setIndex((i) => Math.min(i, total - 1));
  }, [total]);

  const safeIndex = total > 0 ? Math.min(index, total - 1) : 0;
  const card = total > 0 ? deck.cards[safeIndex] : undefined;

  useEffect(() => {
    setFlipped(false);
  }, [index]);

  useEffect(() => {
    if (card) {
      setEditQ(card.question);
      setEditA(card.answer);
    }
  }, [card]);

  if (total === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-slate-600">This deck has no cards yet. Add some in Manage.</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← {deck.name}
        </button>
        <span className="text-sm text-slate-500">
          {safeIndex + 1} / {total}
        </span>
      </div>
      <FlipCard
        question={card.question}
        answer={card.answer}
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={safeIndex === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          onClick={() => {
            if (card) {
              setEditQ(card.question);
              setEditA(card.answer);
              setEditing(true);
            }
          }}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={safeIndex >= total - 1}
          onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {editing && card && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Edit card</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-slate-500">Question</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Answer</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  rows={3}
                  value={editA}
                  onChange={(e) => setEditA(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  onUpdateCard(card.id, editQ, editA);
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
