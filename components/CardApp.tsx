"use client";

import { AdminUsersDialog } from "@/components/AdminUsersDialog";
import { useAuth } from "@/components/AuthContext";
import { useDecks } from "@/components/DecksContext";
import { useTheme } from "@/components/ThemeContext";
import { FlipCard } from "@/components/FlipCard";
import { SortableCardListInDeck, SortableDecksList } from "@/components/SortableDndLists";
import { parseCardCSV } from "@/lib/csv";
import {
  requeueAfterRange,
  shuffleIds,
  studyGradeLabel,
  studyGradePillClass,
  type Grade,
} from "@/lib/reviewQueue";
import { defaultStudySpacing } from "@/lib/storage";
import { getRingOffsetClass, themeLabels, type AppTheme } from "@/lib/theme";
import type { Flashcard, StudySpacingSettings } from "@/lib/types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** One answer per line; must yield at least one line for add / save. */
function answersFromTextarea(s: string): string[] {
  return s
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function answersToTextarea(answers: string[]): string {
  return answers.join("\n");
}

function countSessionSeenForDeck(d: { cards: Flashcard[]; studySessionSeenIds?: string[] }): number {
  const s = new Set(d.studySessionSeenIds ?? []);
  return d.cards.filter((c) => s.has(c.id)).length;
}

function allCurrentCardsSeenInSession(d: { cards: Flashcard[]; studySessionSeenIds?: string[] }): boolean {
  if (d.cards.length === 0) return false;
  const s = new Set(d.studySessionSeenIds ?? []);
  return d.cards.every((c) => s.has(c.id));
}

type DeckListFilter = "all" | "unseen" | "difficult";

function filterDeckCardsForList(
  cards: Flashcard[],
  f: DeckListFilter,
  studySessionSeenIds: string[] | undefined,
  cardLastStudyGrade: Record<string, Grade> | undefined,
): Flashcard[] {
  if (f === "all") return cards;
  const seen = new Set(studySessionSeenIds ?? []);
  if (f === "unseen") {
    return cards.filter((c) => !seen.has(c.id));
  }
  return cards.filter((c) => {
    const g = cardLastStudyGrade?.[c.id];
    return g === "again" || g === "hard";
  });
}

function filterSegmentClass(active: boolean): string {
  return active
    ? "rounded-full border border-blue-500/50 bg-blue-500/12 px-3.5 py-1.5 text-sm font-medium text-blue-100 shadow-md shadow-blue-500/10 ring-1 ring-inset ring-blue-400/20"
    : "rounded-full border border-slate-600/80 bg-slate-800/45 px-3.5 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800/70";
}

type View =
  | { name: "decks" }
  | { name: "manage"; deckId: string }
  | { name: "studyPrep"; deckId: string; from: "decks" | "manage" }
  | { name: "study"; deckId: string; from: "decks" | "manage" };

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
    reorderDecks,
    reorderCards,
    updateStudySpacing,
    appendStudySessionSeen,
    clearStudySessionSeen,
    recordCardStudyGrade,
  } = useDecks();
  const { user, sessionToken, logout } = useAuth();
  const [view, setView] = useState<View>({ name: "decks" });
  const [newDeckName, setNewDeckName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);
  const [prepAnnouncement, setPrepAnnouncement] = useState<string | null>(null);
  const sessionCompleteFiredRef = useRef(false);

  const goStudyPrep = useCallback((deckId: string, from: "decks" | "manage") => {
    setView({ name: "studyPrep", deckId, from });
  }, []);

  const deck = useMemo(
    () => (view.name === "decks" ? null : data.decks.find((d) => d.id === view.deckId) ?? null),
    [data.decks, view],
  );

  const onPresentCardInStudy = useCallback(
    (cardId: string) => {
      if (!deck) return;
      appendStudySessionSeen(deck.id, cardId);
    },
    [deck, appendStudySessionSeen],
  );

  const onGradeInStudy = useCallback(
    (cardId: string, grade: Grade) => {
      if (!deck) return;
      recordCardStudyGrade(deck.id, cardId, grade);
    },
    [deck, recordCardStudyGrade],
  );

  useEffect(() => {
    if (view.name !== "studyPrep") {
      if (view.name === "decks" || view.name === "manage") {
        setPrepAnnouncement(null);
      }
    }
  }, [view.name]);

  useEffect(() => {
    if (view.name !== "study" || !deck) {
      return;
    }
    const from = view.from;
    if (deck.cards.length === 0) {
      sessionCompleteFiredRef.current = false;
      return;
    }
    if (!allCurrentCardsSeenInSession(deck)) {
      sessionCompleteFiredRef.current = false;
      return;
    }
    if (sessionCompleteFiredRef.current) return;
    sessionCompleteFiredRef.current = true;
    setPrepAnnouncement("Nice work — you've seen every card in this session. Take a break or start again when you're ready.");
    setView({ name: "studyPrep", deckId: deck.id, from });
  }, [view, deck]);

  if (view.name !== "decks" && !deck) {
    return <MissingDeck onBack={() => setView({ name: "decks" })} />;
  }

  if (view.name === "manage" && deck) {
    return (
      <ManageDeck
        deck={deck}
        onBack={() => setView({ name: "decks" })}
        onStudy={() => goStudyPrep(deck.id, "manage")}
        onRename={(name) => updateDeck(deck.id, name)}
        onDelete={() => {
          removeDeck(deck.id);
          setView({ name: "decks" });
        }}
        onAddCard={(q, answers) => addCard(deck.id, q, answers)}
        onUpdateCard={(id, q, answers) => updateCard(deck.id, id, q, answers)}
        onRemoveCard={(id) => removeCard(deck.id, id)}
        onImportCSV={(rows) => importCards(deck.id, rows)}
        onReorderCards={(orderedIds) => reorderCards(deck.id, orderedIds)}
        cardLastGrades={deck.cardLastStudyGrade}
        sessionSeenIds={deck.studySessionSeenIds}
      />
    );
  }

  if (view.name === "studyPrep" && deck) {
    return (
      <StudyPrepScreen
        key={deck.id}
        deck={deck}
        from={view.from}
        seenCount={countSessionSeenForDeck(deck)}
        announcement={prepAnnouncement}
        onDismissAnnouncement={() => setPrepAnnouncement(null)}
        onBack={() =>
          setView(
            view.from === "manage"
              ? { name: "manage", deckId: deck.id }
              : { name: "decks" },
          )
        }
        onStartStudying={() => {
          setPrepAnnouncement(null);
          clearStudySessionSeen(deck.id);
          setView({ name: "study", deckId: deck.id, from: view.from });
        }}
        onAddCard={(q, answers) => addCard(deck.id, q, answers)}
        onImportCSV={(rows) => importCards(deck.id, rows)}
        onManageDeck={() => setView({ name: "manage", deckId: deck.id })}
        onResetDeckProgress={() => {
          setPrepAnnouncement(null);
          clearStudySessionSeen(deck.id);
        }}
      />
    );
  }

  if (view.name === "study" && deck) {
    return (
      <StudyDeck
        key={`${deck.id}-study`}
        deck={deck}
        spacing={data.studySpacing}
        onUpdateCard={(cardId, q, answers) => updateCard(deck.id, cardId, q, answers)}
        onBack={() => goStudyPrep(deck.id, view.from)}
        onCardPresented={onPresentCardInStudy}
        onGradeApplied={onGradeInStudy}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Signed in as <span className="font-medium text-slate-300">{user?.username}</span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => setAdminUsersOpen(true)}
              className="rounded-2xl border border-amber-600/50 bg-amber-950/40 px-3.5 py-2 text-sm font-medium text-amber-100 shadow-lg ring-1 ring-amber-500/20 transition hover:bg-amber-900/50"
            >
              Manage users
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-2xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2 text-sm font-medium text-slate-200 shadow-lg shadow-black/20 ring-1 ring-slate-500/20 transition hover:border-slate-500 hover:bg-slate-800/90 active:scale-[0.98]"
          >
            Settings
          </button>
        </div>
      </div>
      {adminUsersOpen && (
        <AdminUsersDialog sessionToken={sessionToken} onClose={() => setAdminUsersOpen(false)} />
      )}
      {settingsOpen && (
        <StudySettingsDialog
          initial={data.studySpacing}
          onClose={() => setSettingsOpen(false)}
          onSave={(s) => {
            updateStudySpacing(s);
            setSettingsOpen(false);
          }}
          onLogout={logout}
        />
      )}

      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">Card Flipper</h1>
        <p className="mt-3 text-pretty text-base text-slate-300">
          Your decks are saved to the server and cached in this browser.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Reorder decks and cards by dragging a row (the ⠿ icon marks draggable rows).
        </p>
      </header>

      <section className="mb-6 ui-elevate p-5">
        <h2 className="text-sm font-semibold text-slate-100">Your decks</h2>
        {data.decks.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-600/80 bg-slate-800/35 px-4 py-8 text-center text-slate-400 ring-1 ring-slate-500/10">
            No decks yet. Add one in the box below.
          </p>
        ) : (
          <div className="mt-3">
            <SortableDecksList
              decks={data.decks}
              onReorder={reorderDecks}
              onStudy={(id) => goStudyPrep(id, "decks")}
              onManage={(id) => setView({ name: "manage", deckId: id })}
            />
          </div>
        )}
      </section>

      <section className="ui-elevate p-5">
        <h2 className="text-sm font-semibold text-slate-100">Create a deck</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const d = addDeck(newDeckName);
            setNewDeckName("");
            setView({ name: "manage", deckId: d.id });
          }}
        >
          <input
            className="ui-input min-h-[48px] flex-1 px-4"
            placeholder="New deck name"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
          />
          <button type="submit" className="ui-btn-primary self-stretch px-5 sm:self-auto">
            Create deck
          </button>
        </form>
      </section>
    </div>
  );
}

function StudySettingsDialog({
  initial,
  onClose,
  onSave,
  onLogout,
}: {
  initial: StudySpacingSettings;
  onClose: () => void;
  onSave: (s: StudySpacingSettings) => void;
  onLogout: () => void | Promise<void>;
}) {
  const { theme, setTheme } = useTheme();
  const { cloudSyncEnabled } = useDecks();
  const [s, setS] = useState<StudySpacingSettings>(initial);

  const row = (key: keyof StudySpacingSettings, label: string) => (
    <div key={key} className="border-b border-slate-700 py-3 last:border-0">
      <p className="text-sm font-medium text-slate-100">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400">Min (cards before next)</label>
          <input
            type="number"
            min={0}
            className="ui-input mt-1 w-full"
            value={s[key].min}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setS((p) => ({ ...p, [key]: { ...p[key], min: n } }));
            }}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Max (cards before next)</label>
          <input
            type="number"
            min={0}
            className="ui-input mt-1 w-full"
            value={s[key].max}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setS((p) => ({ ...p, [key]: { ...p[key], max: n } }));
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="ui-backdrop"
      role="dialog"
      aria-modal
      aria-labelledby="settings-title"
      onClick={onClose}
    >
      <div
        className="ui-elevate max-h-[90dvh] w-full max-w-md overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className="text-lg font-semibold text-slate-100">
          Settings
        </h2>

        <section
          className="mt-4 rounded-2xl border border-slate-600/50 bg-slate-800/35 p-4 ring-1 ring-slate-500/10"
          aria-label="Data storage"
        >
          <h3 className="text-sm font-semibold text-slate-200">Data</h3>
          <p className="mt-1 text-sm text-slate-400">
            {cloudSyncEnabled
              ? "Decks and settings are saved to your Vercel Redis (Upstash) and cached in this browser."
              : "Decks and settings are stored in this browser. To save them on the server, add a Redis (Upstash) store on Vercel and set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."}
          </p>
        </section>

        <section
          className="mt-4 rounded-2xl border border-slate-600/50 bg-slate-800/35 p-4 ring-1 ring-slate-500/10"
          aria-label="Theme"
        >
          <h3 className="text-sm font-semibold text-slate-200">Theme</h3>
          <p className="mt-1 text-sm text-slate-400">
            Choose a color theme for the app. Your choice is saved in this browser.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["dark", "light", "solar"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={filterSegmentClass(theme === t)}
                title={themeLabels[t].desc}
              >
                {themeLabels[t].title}
              </button>
            ))}
          </div>
        </section>

        <section
          className="mt-4 rounded-2xl border border-slate-600/50 bg-slate-800/35 p-4 ring-1 ring-slate-500/10"
          aria-label="Study queue spacing"
        >
          <h3 className="text-sm font-semibold text-slate-200">Study queue spacing</h3>
          <p className="mt-1 text-sm text-slate-400">
            When you rate a card, it is shuffled back into the queue after a random number of
            <em> other </em>
            cards, between min and max.
          </p>
          <div className="mt-2">
            {row("again", "Again")}
            {row("hard", "Hard")}
            {row("good", "Good")}
            {row("easy", "Easy")}
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-700/80 pt-4">
            <button
              type="button"
              className="ui-btn-ghost !px-3 !py-2 text-sm"
              onClick={() => setS(defaultStudySpacing())}
            >
              Reset defaults
            </button>
            <button type="button" className="ui-btn-ghost !px-3 !py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="ui-btn-primary !px-3 !py-2 text-sm" onClick={() => onSave(s)}>
              Save
            </button>
          </div>
        </section>

        <div className="mt-4 border-t border-slate-700/80 pt-4">
          <button
            type="button"
            className="ui-btn-ghost w-full sm:w-auto"
            onClick={() => {
              void onLogout();
              onClose();
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

function MissingDeck({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-slate-300">This deck was removed or is missing.</p>
      <button
        type="button"
        className="mt-6 rounded-xl bg-slate-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-slate-600 active:scale-[0.98]"
        onClick={onBack}
      >
        Back to decks
      </button>
    </div>
  );
}

function AddCardAndCsvForm({
  onAddCard,
  onImportCSV,
}: {
  onAddCard: (q: string, answers: string[]) => void;
  onImportCSV: (rows: { question: string; answers: string[] }[]) => number;
}) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvOk, setCsvOk] = useState<string | null>(null);

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
    <>
      <section className="mb-10 ui-elevate p-5">
        <h2 className="text-sm font-semibold text-slate-100">Add card</h2>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const answers = answersFromTextarea(a);
            if (answers.length === 0) return;
            onAddCard(q, answers);
            setQ("");
            setA("");
          }}
        >
          <div>
            <label className="text-xs text-slate-400">Question</label>
            <textarea
              className="ui-input mt-1 min-h-[5.5rem] w-full"
              rows={3}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Answers (one per line)</label>
            <textarea
              className="ui-input mt-1 min-h-[5.5rem] w-full"
              rows={4}
              placeholder="First answer&#10;Optional second line for another phrasing or language"
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="ui-btn-primary !px-4 !py-2 text-sm">
              Add card
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10 ui-elevate p-5">
        <h2 className="text-sm font-semibold text-slate-100">Import from CSV</h2>
        <p className="mt-1 text-sm text-slate-400">
          First column is the question. Each further column is another answer, shown together on the back (e.g.{" "}
          <code className="rounded bg-slate-800 px-1 text-slate-200">question,answer1,answer2</code>). A header
          like <code className="rounded bg-slate-800 px-1 text-slate-200">question,answer,answer</code> or{" "}
          <code className="rounded bg-slate-800 px-1 text-slate-200">front,back</code> is optional. Use quotes if a
          field contains a comma.
        </p>
        <div className="mt-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-sm file:text-slate-200"
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
          className="ui-input mt-3 w-full font-mono text-sm"
          rows={5}
          placeholder="question,answer,answer (optional extra columns)&#10;Cuptor cu microunde,でんしレンジ,電子レンジ"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ui-btn-ghost !px-3 !py-2 text-sm"
            onClick={() => runImport(csvText)}
          >
            Import from text
          </button>
          {csvError && <p className="text-sm text-red-400">{csvError}</p>}
          {csvOk && <p className="text-sm text-green-400">{csvOk}</p>}
        </div>
      </section>
    </>
  );
}

function DeckCardListReadonly({
  cards,
  cardLastGrades,
}: {
  cards: Flashcard[];
  cardLastGrades: Record<string, Grade> | undefined;
}) {
  if (cards.length === 0) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        No cards in this list. Try a different filter or &quot;All cards&quot; to see the full deck.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/50 ring-1 ring-slate-500/10">
      {cards.map((c) => {
        const g = cardLastGrades?.[c.id];
        return (
          <li key={c.id} className="px-4 py-3 text-left">
            <p className="line-clamp-2 text-sm font-medium text-slate-100">{c.question}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
              {c.answers.length > 0 ? c.answers.join(" · ") : "—"}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              <span className="text-slate-600">Last: </span>
              {g ? (
                <span className={studyGradePillClass(g)} title="Last study feedback">
                  {studyGradeLabel(g)}
                </span>
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function StudyPrepScreen({
  deck,
  from,
  seenCount,
  announcement,
  onDismissAnnouncement,
  onBack,
  onStartStudying,
  onAddCard,
  onImportCSV,
  onManageDeck,
  onResetDeckProgress,
}: {
  deck: {
    name: string;
    cards: Flashcard[];
    cardLastStudyGrade?: Record<string, Grade>;
    studySessionSeenIds?: string[];
  };
  from: "decks" | "manage";
  seenCount: number;
  announcement: string | null;
  onDismissAnnouncement: () => void;
  onBack: () => void;
  onStartStudying: () => void;
  onAddCard: (q: string, answers: string[]) => void;
  onImportCSV: (rows: { question: string; answers: string[] }[]) => number;
  onManageDeck: () => void;
  onResetDeckProgress: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [listFilter, setListFilter] = useState<DeckListFilter>("all");
  const total = deck.cards.length;
  const ratio = total > 0 ? Math.min(1, seenCount / total) : 0;
  const sessionComplete = total > 0 && allCurrentCardsSeenInSession(deck);
  const backLabel = from === "manage" ? "← Back" : "← Decks";
  const filteredCards = useMemo(
    () =>
      filterDeckCardsForList(
        deck.cards,
        listFilter,
        deck.studySessionSeenIds,
        deck.cardLastStudyGrade,
      ),
    [deck.cards, deck.studySessionSeenIds, deck.cardLastStudyGrade, listFilter],
  );

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-8">
      {announcement && (
        <div
          className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100 shadow-lg ring-1 ring-inset ring-emerald-500/15"
          role="status"
          aria-live="polite"
        >
          <p className="min-w-0 flex-1 leading-relaxed">{announcement}</p>
          <button
            type="button"
            onClick={onDismissAnnouncement}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-emerald-200/90 hover:bg-emerald-900/50"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="-m-1 shrink-0 rounded-lg px-3 py-2.5 text-base font-semibold text-blue-400 transition hover:bg-slate-800/50 hover:underline"
        >
          {backLabel}
        </button>
        <h1 className="min-w-0 flex-1 text-lg font-semibold text-slate-100">{deck.name}</h1>
        <button type="button" onClick={onManageDeck} className="ui-btn-primary !px-3 !py-2 text-sm">
          Manage deck
        </button>
      </div>

      <p className="text-sm text-slate-300">Session progress — unique cards you&apos;ve already seen in this run.</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100">
        {seenCount} <span className="text-base font-medium text-slate-500">/</span> {total}
      </p>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-inset ring-slate-700/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={seenCount}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-200"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      {sessionComplete && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">Every card in this session has been shown at least once.</p>
          <button
            type="button"
            onClick={onResetDeckProgress}
            className="self-start rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-900/40"
          >
            Reset deck
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onStartStudying}
          disabled={total === 0}
          className="ui-btn-primary !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
        >
          {seenCount > 0 ? "Start again" : "Start studying"}
        </button>
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="ui-btn-ghost !px-4 !py-2 text-sm"
        >
          {addOpen ? "Hide add / import" : "Add cards"}
        </button>
      </div>

      {addOpen && (
        <div className="mt-6">
          <AddCardAndCsvForm onAddCard={onAddCard} onImportCSV={onImportCSV} />
        </div>
      )}

      <section className={addOpen ? "mt-2" : "mt-8"}>
        <h2 className="text-sm font-semibold text-slate-100">
          {listFilter === "all" ? "All cards in this deck" : "Filtered cards"}{" "}
          {total > 0
            ? listFilter === "all"
              ? `(${total})`
              : `(${filteredCards.length} of ${total})`
            : "(0)"}
        </h2>
        {total === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No cards yet. Add cards or import a CSV above.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setListFilter("all")}
                className={filterSegmentClass(listFilter === "all")}
              >
                All cards
              </button>
              <button
                type="button"
                onClick={() => setListFilter("unseen")}
                className={filterSegmentClass(listFilter === "unseen")}
                title="Cards you have not seen yet in the current study session"
              >
                Unseen this session
              </button>
              <button
                type="button"
                onClick={() => setListFilter("difficult")}
                className={filterSegmentClass(listFilter === "difficult")}
                title="Last rating was Again or Hard"
              >
                Again or Hard
              </button>
            </div>
            <DeckCardListReadonly cards={filteredCards} cardLastGrades={deck.cardLastStudyGrade} />
          </>
        )}
      </section>
    </div>
  );
}

function ManageDeck({
  deck,
  cardLastGrades,
  sessionSeenIds,
  onBack,
  onStudy,
  onRename,
  onDelete,
  onAddCard,
  onUpdateCard,
  onRemoveCard,
  onImportCSV,
  onReorderCards,
}: {
  deck: { id: string; name: string; cards: Flashcard[] };
  cardLastGrades?: Record<string, Grade>;
  sessionSeenIds?: string[];
  onBack: () => void;
  onStudy: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddCard: (q: string, answers: string[]) => void;
  onUpdateCard: (id: string, q: string, answers: string[]) => void;
  onRemoveCard: (id: string) => void;
  onImportCSV: (rows: { question: string; answers: string[] }[]) => number;
  onReorderCards: (orderedCardIds: string[]) => void;
}) {
  const [title, setTitle] = useState(deck.name);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [listFilter, setListFilter] = useState<DeckListFilter>("all");

  const filteredManageCards = useMemo(
    () => filterDeckCardsForList(deck.cards, listFilter, sessionSeenIds, cardLastGrades),
    [deck.cards, listFilter, sessionSeenIds, cardLastGrades],
  );

  useEffect(() => {
    setTitle(deck.name);
  }, [deck.name]);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="-m-1 shrink-0 rounded-lg px-3 py-2.5 text-base font-semibold text-blue-400 transition hover:bg-slate-800/50 hover:underline"
        >
          ← Decks
        </button>
        <span className="text-slate-600">|</span>
        <button type="button" onClick={onStudy} className="ui-btn-primary !px-3 !py-1.5 text-sm">
          Study
        </button>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="text-xs font-medium uppercase text-slate-400">Deck name</label>
          <input
            className="ui-input mt-1 w-full max-w-md text-lg font-semibold"
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
          className="self-start rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-200 hover:bg-red-900/40"
        >
          Delete deck
        </button>
      </div>

      <AddCardAndCsvForm onAddCard={onAddCard} onImportCSV={onImportCSV} />

      <section>
        <h2 className="text-sm font-semibold text-slate-100">
          {listFilter === "all" ? "Cards" : "Filtered cards"}{" "}
          {deck.cards.length > 0
            ? listFilter === "all"
              ? `(${deck.cards.length})`
              : `(${filteredManageCards.length} of ${deck.cards.length})`
            : "(0)"}
        </h2>
        {deck.cards.length > 0 && (
          <div className="mb-2 mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setListFilter("all")}
              className={filterSegmentClass(listFilter === "all")}
            >
              All cards
            </button>
            <button
              type="button"
              onClick={() => setListFilter("unseen")}
              className={filterSegmentClass(listFilter === "unseen")}
              title="Cards you have not seen yet in the current study session"
            >
              Unseen this session
            </button>
            <button
              type="button"
              onClick={() => setListFilter("difficult")}
              className={filterSegmentClass(listFilter === "difficult")}
              title="Last rating was Again or Hard"
            >
              Again or Hard
            </button>
          </div>
        )}
        {listFilter !== "all" && deck.cards.length > 0 && (
          <p className="mb-2 text-xs text-amber-200/80">
            Reorder and drag are available only with &quot;All cards&quot; selected.
          </p>
        )}
        <p className="mb-2 mt-1 text-xs text-slate-400">
          {listFilter === "all"
            ? "Drag a card row to change order (same order is used in Study). The ⠿ icon shows draggable rows."
            : "Switch to “All cards” to edit, remove, or reorder."}
        </p>
        <div className="mt-2">
          {listFilter === "all" ? (
            <SortableCardListInDeck
              cards={deck.cards}
              cardLastGrades={cardLastGrades}
              onReorder={onReorderCards}
              onEdit={(c) => {
                setEditing(c);
                setEditQ(c.question);
                setEditA(answersToTextarea(c.answers));
              }}
              onRemove={onRemoveCard}
            />
          ) : (
            <DeckCardListReadonly cards={filteredManageCards} cardLastGrades={cardLastGrades} />
          )}
        </div>
      </section>

      {editing && (
        <div className="ui-backdrop" role="dialog" aria-modal onClick={() => setEditing(null)}>
          <div
            className="ui-elevate w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Edit card</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-slate-400">Question</label>
                <textarea
                  className="ui-input mt-1 min-h-[5.5rem] w-full"
                  rows={3}
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Answers (one per line)</label>
                <textarea
                  className="ui-input mt-1 min-h-[6rem] w-full"
                  rows={4}
                  value={editA}
                  onChange={(e) => setEditA(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="ui-btn-ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  const nextAnswers = answersFromTextarea(editA);
                  if (nextAnswers.length === 0) return;
                  onUpdateCard(editing.id, editQ, nextAnswers);
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

function gradeButtonClass(g: Grade, theme: AppTheme): string {
  const ro = getRingOffsetClass(theme);
  const base = `rounded-xl px-3 py-2.5 text-sm font-semibold shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.98] ${ro}`;
  if (g === "again")
    return `${base} border border-red-800/60 bg-red-950/50 text-red-200 hover:bg-red-900/50 focus:ring-red-500/50`;
  if (g === "hard")
    return `${base} border border-orange-800/60 bg-orange-950/40 text-orange-200 hover:bg-orange-900/40 focus:ring-orange-500/50`;
  if (g === "good")
    return `${base} border border-lime-800/50 bg-lime-950/30 text-lime-200 hover:bg-lime-900/40 focus:ring-lime-500/50`;
  return `${base} border border-emerald-800/50 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/40 focus:ring-emerald-500/50`;
}

function StudyDeck({
  deck,
  spacing,
  onBack,
  onUpdateCard,
  onCardPresented,
  onGradeApplied,
}: {
  deck: { name: string; cards: Flashcard[] };
  spacing: StudySpacingSettings;
  onBack: () => void;
  onUpdateCard: (cardId: string, q: string, answers: string[]) => void;
  onCardPresented?: (cardId: string) => void;
  onGradeApplied?: (cardId: string, grade: Grade) => void;
}) {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const onPresentedRef = useRef(onCardPresented);
  onPresentedRef.current = onCardPresented;
  const onGradeRef = useRef(onGradeApplied);
  onGradeRef.current = onGradeApplied;

  const idsKey = useMemo(
    () =>
      deck.cards
        .map((c) => c.id)
        .slice()
        .sort()
        .join(","),
    [deck.cards],
  );

  useLayoutEffect(() => {
    if (deck.cards.length === 0) {
      setQueue([]);
      return;
    }
    setQueue(shuffleIds(deck.cards.map((c) => c.id)));
    // Reshuffle only when which cards exist in the deck changes (idsKey), not on every deck object reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const currentId = queue[0];
  const card = currentId ? deck.cards.find((c) => c.id === currentId) : undefined;

  useEffect(() => {
    if (currentId) onPresentedRef.current?.(currentId);
  }, [currentId]);

  useEffect(() => {
    setFlipped(false);
  }, [currentId]);

  useEffect(() => {
    if (card) {
      setEditQ(card.question);
      setEditA(answersToTextarea(card.answers));
    }
  }, [card]);

  const applyGrade = (g: Grade) => {
    if (!currentId) return;
    onGradeRef.current?.(currentId, g);
    setQueue((q) => requeueAfterRange(q, spacing[g], currentId));
    setFlipped(false);
  };

  const totalInDeck = deck.cards.length;

  if (totalInDeck === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-slate-300">This deck has no cards yet. Add some in Manage.</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-slate-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-slate-600 active:scale-[0.98]"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    );
  }

  if (!currentId || !card) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-slate-300">Loading…</p>
        <button
          type="button"
          className="mt-4 rounded-lg px-4 py-2.5 text-base font-semibold text-blue-400 transition hover:bg-slate-800/50 hover:underline"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    );
  }

  const gradeLabels: { key: Grade; label: string }[] = [
    { key: "again", label: "Again" },
    { key: "hard", label: "Hard" },
    { key: "good", label: "Good" },
    { key: "easy", label: "Easy" },
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="-m-1 max-w-[min(100%,20rem)] shrink-0 rounded-lg px-3 py-2.5 text-left text-base font-semibold leading-snug text-blue-400 transition hover:bg-slate-800/50 hover:underline"
        >
          ← {deck.name}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">In queue: {queue.length}</span>
          <button
            type="button"
            className="ui-btn-ghost !px-2.5 !py-1.5 text-xs"
            onClick={() => {
              setEditQ(card.question);
              setEditA(answersToTextarea(card.answers));
              setEditing(true);
            }}
          >
            Edit
          </button>
        </div>
      </div>

      <p className="mb-2 text-center text-xs text-slate-400">Study order is shuffled. Rate after you turn the card.</p>

      <FlipCard
        question={card.question}
        answers={card.answers}
        flipped={flipped}
        onFlip={() => setFlipped(true)}
        revealActions={
          <div className="grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
            {gradeLabels.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={gradeButtonClass(key, theme)}
                onClick={() => applyGrade(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {editing && card && (
        <div className="ui-backdrop" role="dialog" aria-modal onClick={() => setEditing(false)}>
          <div
            className="ui-elevate w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Edit card</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="text-xs text-slate-400">Question</label>
                <textarea
                  className="ui-input mt-1 min-h-[5.5rem] w-full"
                  rows={3}
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Answers (one per line)</label>
                <textarea
                  className="ui-input mt-1 min-h-[6rem] w-full"
                  rows={4}
                  value={editA}
                  onChange={(e) => setEditA(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="ui-btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn-primary"
                onClick={() => {
                  const nextAnswers = answersFromTextarea(editA);
                  if (nextAnswers.length === 0) return;
                  onUpdateCard(card.id, editQ, nextAnswers);
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
