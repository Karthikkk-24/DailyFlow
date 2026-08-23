"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addWeeks, format, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { BLOCK_CATEGORIES, type BlockCategory, type ScheduleBlock } from "@/types";
import {
  cn,
  todayKey,
  weekDates,
  timeToMinutes,
  minutesToTime,
} from "@/lib/utils";
import { useTodayKey } from "@/hooks/use-today-key";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6..21
const CATEGORY_COLORS: Record<BlockCategory, string> = {
  deep_work: "#0D9488",
  meetings: "#2563EB",
  exercise: "#16A34A",
  personal: "#7C3AED",
  study: "#D97706",
};

function slotId(date: string, hour: number) {
  return `slot|${date}|${hour}`;
}

function parseSlotId(id: string): { date: string; hour: number } | null {
  if (!id.startsWith("slot|")) return null;
  const [, date, hourStr] = id.split("|");
  const hour = Number(hourStr);
  if (!date || Number.isNaN(hour)) return null;
  return { date, hour };
}

function DraggableBlock({
  block,
  onOpen,
}: {
  block: ScheduleBlock;
  onOpen: (b: ScheduleBlock) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: block.id, data: { block } });
  const draggedRef = useRef(false);
  const top = ((timeToMinutes(block.startTime) - 6 * 60) / 60) * 64;
  const height = Math.max(
    28,
    ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60) * 64,
  );

  useEffect(() => {
    if (isDragging) draggedRef.current = true;
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        onOpen(block);
      }}
      className={cn(
        "absolute inset-x-1 z-10 cursor-grab touch-none overflow-hidden rounded-lg border border-white/20 px-2 py-1 text-left text-white shadow-sm active:cursor-grabbing",
        isDragging && "opacity-60 ring-2 ring-white",
      )}
      style={{
        top,
        height,
        background: CATEGORY_COLORS[block.category],
        transform: CSS.Translate.toString(transform),
      }}
      title="Drag to move · click to edit"
    >
      <p className="truncate text-xs font-semibold">{block.title}</p>
      <p className="truncate text-[10px] opacity-90">
        {block.startTime}–{block.endTime}
      </p>
    </div>
  );
}

function HourSlot({
  date,
  hour,
  onCreate,
}: {
  date: string;
  hour: number;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(date, hour) });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "h-16 w-full border-b border-border/60 hover:bg-muted/40",
        isOver && "bg-primary/15",
      )}
      aria-label={`Add or drop block ${date} ${hour}:00`}
      onClick={onCreate}
    />
  );
}

export default function PlannerPage() {
  const { state, dispatch } = useDayFlow();
  const today = useTodayKey();
  const [weekOffset, setWeekOffset] = useState(0);
  // Recompute when the local calendar day or week offset changes.
  const days = useMemo(
    () => weekDates(addWeeks(parseISO(`${today}T12:00:00`), weekOffset), 1),
    [today, weekOffset],
  );
  const weekStart = format(days[0], "yyyy-MM-dd");
  const weekEnd = format(days[6], "yyyy-MM-dd");
  const weekLabel =
    format(days[0], "MMM d") + " – " + format(days[6], "MMM d, yyyy");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "deep_work" as BlockCategory,
    date: todayKey(),
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });
  const [error, setError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const d of days) {
      const key = format(d, "yyyy-MM-dd");
      map.set(
        key,
        state.scheduleBlocks
          .filter((b) => b.date === key)
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    }
    return map;
  }, [days, state.scheduleBlocks]);

  function openCreate(date?: string, hour?: number) {
    setEditing(null);
    const start =
      hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "09:00";
    const end =
      hour !== undefined
        ? `${String(Math.min(hour + 1, 22)).padStart(2, "0")}:00`
        : "10:00";
    const defaultDate =
      date ??
      (days.some((d) => format(d, "yyyy-MM-dd") === today)
        ? today
        : weekStart);
    setForm({
      title: "",
      category: "deep_work",
      date: defaultDate,
      startTime: start,
      endTime: end,
      notes: "",
    });
    setError("");
    setOpen(true);
  }

  function openEdit(block: ScheduleBlock) {
    setEditing(block);
    setForm({
      title: block.title,
      category: block.category,
      date: block.date,
      startTime: block.startTime,
      endTime: block.endTime,
      notes: block.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  function save() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    const startMin = timeToMinutes(form.startTime);
    const endMin = timeToMinutes(form.endTime);
    if (endMin <= startMin) {
      setError("End time must be after start time.");
      return;
    }
    const gridStart = 6 * 60;
    const gridEnd = 22 * 60;
    if (startMin < gridStart || endMin > gridEnd) {
      setError("Blocks must stay within the visible grid (06:00–22:00).");
      return;
    }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes.trim() || undefined,
    };
    if (editing) {
      dispatch({ type: "UPDATE_BLOCK", id: editing.id, patch: payload });
    } else {
      dispatch({ type: "ADD_BLOCK", block: payload });
    }
    setOpen(false);
  }

  function moveBlockToSlot(block: ScheduleBlock, date: string, hour: number) {
    const duration = Math.max(
      30,
      timeToMinutes(block.endTime) - timeToMinutes(block.startTime),
    );
    const startMin = hour * 60;
    const endMin = Math.min(22 * 60, startMin + duration);
    dispatch({
      type: "UPDATE_BLOCK",
      id: block.id,
      patch: {
        date,
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(endMin),
      },
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const block = state.scheduleBlocks.find((b) => b.id === active.id);
    const slot = parseSlotId(String(over.id));
    if (!block || !slot) return;
    if (
      block.date === slot.date &&
      timeToMinutes(block.startTime) === slot.hour * 60
    ) {
      return;
    }
    moveBlockToSlot(block, slot.date, slot.hour);
  }

  return (
    <div>
      <PageHeader
        title="Planner"
        description="Weekly time blocks — drag to move date and time."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> New block
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous week"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next week"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium">{weekLabel}</p>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
            >
              This week
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {BLOCK_CATEGORIES.map((c) => (
            <Badge key={c.value} className="gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CATEGORY_COLORS[c.value] }}
              />
              {c.label}
            </Badge>
          ))}
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="mb-2 grid grid-cols-[56px_repeat(7,1fr)] gap-2">
              <div />
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "rounded-xl px-2 py-2 text-center text-sm",
                    isSameDay(d, new Date()) && "bg-primary/15 text-primary",
                  )}
                >
                  <div className="font-medium">{format(d, "EEE")}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(d, "MMM d")}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-2">
              <div className="space-y-0">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="h-16 pr-2 text-right text-[11px] text-muted-foreground"
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const blocks = blocksByDate.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className="relative rounded-xl border border-border bg-card/50"
                  >
                    {HOURS.map((h) => (
                      <HourSlot
                        key={h}
                        date={key}
                        hour={h}
                        onCreate={() => openCreate(key, h)}
                      />
                    ))}
                    {blocks.map((block) => (
                      <DraggableBlock
                        key={block.id}
                        block={block}
                        onOpen={openEdit}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>

      {state.scheduleBlocks.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No schedule blocks"
            description="Click a time slot or create a block to plan your week."
            action={<Button onClick={() => openCreate()}>New block</Button>}
          />
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit block" : "New block"}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="btitle">Title</Label>
            <Input
              id="btitle"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={200}
            />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as BlockCategory })
              }
            >
              {BLOCK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="bdate">Date</Label>
              <Input
                id="bdate"
                type="date"
                min={weekStart}
                max={weekEnd}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bstart">Start</Label>
              <Input
                id="bstart"
                type="time"
                min="06:00"
                max="21:30"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="bend">End</Label>
              <Input
                id="bend"
                type="time"
                min="06:30"
                max="22:00"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bnotes">Notes</Label>
            <Textarea
              id="bnotes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-between pt-2">
            {editing ? (
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteId(editing.id);
                  setOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete block?"
        description="This removes the time block from your planner."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteId) dispatch({ type: "DELETE_BLOCK", id: deleteId });
        }}
      />
    </div>
  );
}
