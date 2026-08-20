"use client";

import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { BLOCK_CATEGORIES, type BlockCategory, type ScheduleBlock } from "@/types";
import { cn, todayKey, weekDates, timeToMinutes } from "@/lib/utils";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6..21
const CATEGORY_COLORS: Record<BlockCategory, string> = {
  deep_work: "#0D9488",
  meetings: "#2563EB",
  exercise: "#16A34A",
  personal: "#7C3AED",
  study: "#D97706",
};

export default function PlannerPage() {
  const { state, dispatch } = useDayFlow();
  const days = useMemo(() => weekDates(new Date(), 1), []);
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
    const start = hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "09:00";
    const end =
      hour !== undefined
        ? `${String(hour + 1).padStart(2, "0")}:00`
        : "10:00";
    setForm({
      title: "",
      category: "deep_work",
      date: date ?? todayKey(),
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
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      setError("End time must be after start time.");
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

  function moveBlock(block: ScheduleBlock, date: string) {
    dispatch({ type: "UPDATE_BLOCK", id: block.id, patch: { date } });
  }

  return (
    <div>
      <PageHeader
        title="Planner"
        description="Weekly time blocks — distinct from tasks."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> New block
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
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
                <div className="text-xs text-muted-foreground">{format(d, "MMM d")}</div>
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
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/block-id");
                    const block = state.scheduleBlocks.find((b) => b.id === id);
                    if (block && block.date !== key) moveBlock(block, key);
                  }}
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className="h-16 w-full border-b border-border/60 hover:bg-muted/40"
                      aria-label={`Add block ${key} ${h}:00`}
                      onClick={() => openCreate(key, h)}
                    />
                  ))}
                  {blocks.map((block) => {
                    const top =
                      ((timeToMinutes(block.startTime) - 6 * 60) / 60) * 64;
                    const height = Math.max(
                      28,
                      ((timeToMinutes(block.endTime) -
                        timeToMinutes(block.startTime)) /
                        60) *
                        64,
                    );
                    return (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/block-id", block.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(block);
                        }}
                        className="absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border border-white/20 px-2 py-1 text-left text-white shadow-sm"
                        style={{
                          top,
                          height,
                          background: CATEGORY_COLORS[block.category],
                        }}
                        title="Drag to another day · click to edit"
                      >
                        <p className="truncate text-xs font-semibold">{block.title}</p>
                        <p className="truncate text-[10px] opacity-90">
                          {block.startTime}–{block.endTime}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {state.scheduleBlocks.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No schedule blocks"
            description="Click a time slot or create a block to plan your week."
            action={<Button onClick={() => openCreate()}>New block</Button>}
          />
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit block" : "New block"}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="btitle">Title</Label>
            <Input
              id="btitle"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="bdate">Date</Label>
              <Input
                id="bdate"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bstart">Start</Label>
              <Input
                id="bstart"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bend">End</Label>
              <Input
                id="bend"
                type="time"
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
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
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
