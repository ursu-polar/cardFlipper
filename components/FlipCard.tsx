"use client";

type Props = {
  question: string;
  answer: string;
  flipped: boolean;
  onFlip: () => void;
};

export function FlipCard({ question, answer, flipped, onFlip }: Props) {
  return (
    <div className="card-flip-perspective mx-auto w-full max-w-lg">
      <div
        className={`card-flip-inner relative aspect-[4/3] w-full rounded-2xl shadow-lg ${flipped ? "is-flipped" : ""}`}
      >
        <div
          className="card-flip-face absolute inset-0 flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
          <p className="mt-3 flex-1 text-lg leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
            {question || "—"}
          </p>
        </div>
        <div
          className="card-flip-face card-flip-back absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
            {question || "—"}
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Answer</p>
          <p className="mt-1 flex-1 text-lg leading-relaxed text-slate-900 whitespace-pre-wrap break-words">
            {answer || "—"}
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onFlip}
          className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Turn
        </button>
      </div>
    </div>
  );
}
