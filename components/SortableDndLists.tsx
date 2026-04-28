"use client";

import type { PointerEvent } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { studyGradeLabel, studyGradePillClass, type Grade } from "@/lib/reviewQueue";
import type { Deck, Flashcard } from "@/lib/types";

/** Stops the row’s drag sensor from treating clicks on actions as a drag. */
function stopRowDrag(e: PointerEvent<HTMLButtonElement>) {
  e.stopPropagation();
}

function GripIcon() {
  return (
    <span className="select-none text-base leading-none" aria-hidden>
      ⠿
    </span>
  );
}

function SortableDeckItem({
  deck,
  onStudy,
  onManage,
}: {
  deck: Deck;
  onStudy: (id: string) => void;
  onManage: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deck.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
      className={`flex list-none cursor-grab touch-none items-center justify-between gap-2 rounded-2xl border border-slate-600/60 bg-slate-900/80 px-2.5 py-2.5 shadow-md ring-1 ring-slate-500/10 active:cursor-grabbing ${
        isDragging
          ? "z-10 cursor-grabbing opacity-90 ring-2 ring-blue-500/40"
          : "hover:border-slate-500/70 hover:bg-slate-800/30"
      } `}
    >
      <div
        className="flex h-9 w-8 shrink-0 items-center justify-center self-center rounded-lg border border-slate-600/70 bg-slate-800/60 text-slate-500"
        aria-hidden
      >
        <GripIcon />
      </div>
      <div className="min-w-0 flex-1 pl-0.5">
        <p className="font-medium text-slate-100">{deck.name}</p>
        <p className="text-sm text-slate-400">
          {deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}
        </p>
      </div>
      <div className="flex shrink-0 gap-2 pr-0.5">
        <button
          type="button"
          className="ui-btn-ghost !px-3 !py-2 text-sm"
          onPointerDown={stopRowDrag}
          onClick={() => onStudy(deck.id)}
        >
          Study
        </button>
        <button
          type="button"
          className="ui-btn-primary !px-3 !py-2 text-sm"
          onPointerDown={stopRowDrag}
          onClick={() => onManage(deck.id)}
        >
          Manage
        </button>
      </div>
    </li>
  );
}

export function SortableDecksList({
  decks,
  onReorder,
  onStudy,
  onManage,
}: {
  decks: Deck[];
  onReorder: (orderedIds: string[]) => void;
  onStudy: (id: string) => void;
  onManage: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = decks.map((d) => d.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove([...ids], oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {decks.map((d) => (
            <SortableDeckItem
              key={d.id}
              deck={d}
              onStudy={onStudy}
              onManage={onManage}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableCardItem({
  card,
  lastGrade,
  onEdit,
  onRemove,
}: {
  card: Flashcard;
  lastGrade: Grade | undefined;
  onEdit: (c: Flashcard) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
      className={`flex list-none cursor-grab touch-none items-start justify-between gap-2 rounded-2xl border border-slate-600/60 bg-slate-800/70 py-2 pl-2 pr-2 shadow-sm ring-1 ring-slate-500/10 active:cursor-grabbing ${
        isDragging
          ? "z-10 cursor-grabbing opacity-90 ring-2 ring-blue-500/40"
          : "hover:border-slate-500/70 hover:bg-slate-800/55"
      } `}
    >
      <div
        className="mt-0.5 flex h-9 w-8 shrink-0 items-center justify-center self-center rounded-lg border border-slate-600/70 bg-slate-800/60 text-slate-500"
        aria-hidden
      >
        <GripIcon />
      </div>
      <div className="min-w-0 flex-1 self-center">
        <p className="truncate text-sm font-medium text-slate-100">{card.question || "—"}</p>
        <p className="truncate text-sm text-slate-300">
          {card.answers.length > 0 ? card.answers.join(" · ") : "—"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          <span className="text-slate-600">Last: </span>
          {lastGrade ? (
            <span className={studyGradePillClass(lastGrade)} title="Last study feedback">
              {studyGradeLabel(lastGrade)}
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center pr-0.5">
        <button
          type="button"
          className="ui-btn-ghost !px-3 !py-1.5 text-sm"
          onPointerDown={stopRowDrag}
          onClick={() => onEdit(card)}
        >
          Edit
        </button>
        <button
          type="button"
          className="cursor-pointer text-sm text-red-400 hover:underline"
          onPointerDown={stopRowDrag}
          onClick={() => onRemove(card.id)}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function SortableCardListInDeck({
  cards,
  cardLastGrades,
  onReorder,
  onEdit,
  onRemove,
}: {
  cards: Flashcard[];
  /** Per card id, last Again / Hard / Good / Easy from study mode. */
  cardLastGrades?: Record<string, Grade>;
  onReorder: (orderedCardIds: string[]) => void;
  onEdit: (c: Flashcard) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = cards.map((c) => c.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove([...ids], oldIndex, newIndex));
  }

  if (cards.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-600/80 py-6 text-center text-slate-400 ring-1 ring-slate-500/10">
        No cards. Add one above or import CSV.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {cards.map((c) => (
            <SortableCardItem
              key={c.id}
              card={c}
              lastGrade={cardLastGrades?.[c.id]}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
