"use client";

import { useTheme } from "@/components/ThemeContext";
import { getFlipCardRingOffsetClass } from "@/lib/theme";
import type { ReactNode } from "react";

type Props = {
  question: string;
  /** All shown together on the back when the card is turned. */
  answers: string[];
  flipped: boolean;
  onFlip: () => void;
  /** Shown below the card when `flipped` (e.g. grade buttons). Replaces the Turn button. */
  revealActions?: ReactNode;
};

export function FlipCard({ question, answers, flipped, onFlip, revealActions }: Props) {
  const { theme } = useTheme();
  const flipRing = getFlipCardRingOffsetClass(theme);

  return (
    <div className="card-flip-perspective mx-auto w-full max-w-lg">
      <div
        className={`card-flip-inner relative aspect-[4/3] w-full rounded-3xl shadow-2xl shadow-black/30 ring-1 ring-slate-500/15 ${flipped ? "is-flipped" : ""}`}
      >
        <div
          className="card-flip-face absolute inset-0 flex flex-col rounded-3xl border border-slate-600/70 bg-slate-900 p-6 shadow-inner"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Question</p>
          <p className="mt-3 flex-1 text-lg leading-relaxed text-slate-100 whitespace-pre-wrap break-words">
            {question || "—"}
          </p>
        </div>
        <div
          className="card-flip-face card-flip-back absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-slate-600/70 bg-slate-800/95 p-6 shadow-inner"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Question</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
            {question || "—"}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            {answers.length > 1 ? "Answers" : "Answer"}
          </p>
          <div className="mt-2 flex min-h-0 flex-1 flex-col justify-start gap-3 sm:gap-4">
            {answers.length > 0 ? (
              answers.map((a, i) => (
                <p
                  key={i}
                  className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-slate-100 sm:text-4xl md:text-5xl whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere]"
                >
                  {a}
                </p>
              ))
            ) : (
              <p className="text-3xl font-semibold text-slate-100 sm:text-4xl md:text-5xl">—</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex min-h-[48px] flex-col items-center justify-center gap-3">
        {!flipped && (
          <button
            type="button"
            onClick={onFlip}
            className={`rounded-full bg-gradient-to-b from-blue-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 active:scale-[0.98] ${flipRing}`}
          >
            Turn
          </button>
        )}
        {flipped && revealActions}
      </div>
    </div>
  );
}
