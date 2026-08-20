"use client";

import Link from "next/link";
import { useState } from "react";
import * as Icons from "lucide-react";
import { Plus } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn, todayKey } from "@/lib/utils";
import {
  computeStreak,
  isHabitCompletedOn,
} from "@/lib/analytics/score";
import { HABIT_COLORS, HABIT_ICONS, type HabitFrequency } from "@/types";

function HabitIcon({ name, className }: { name: string; className?: string }) {
  // Dynamic lucide lookup for habit icon names stored in state
  const icons = Icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string }>
  >;
  const Icon = icons[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HabitsPage() {
  const { state, dispatch } = useDayFlow();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(HABIT_ICONS[0]);
  const [color, setColor] = useState<string>(HABIT_COLORS[0]);
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [targetDays, setTargetDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState("");

  function resetForm() {
    setName("");
    setIcon(HABIT_ICONS[0]);
    setColor(HABIT_COLORS[0]);
    setFrequency("daily");
    setTargetDays([0, 1, 2, 3, 4, 5, 6]);
    setError("");
  }

  function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (targetDays.length === 0) {
      setError("Pick at least one target day.");
      return;
    }
    dispatch({
      type: "ADD_HABIT",
      habit: {
        name: name.trim(),
        icon,
        color,
        frequency,
        targetDays: frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : targetDays,
      },
    });
    setOpen(false);
    resetForm();
  }

  function toggleDay(d: number) {
    setTargetDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  return (
    <div>
      <PageHeader
        title="Habits"
        description="Build streaks with daily and weekly habits."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New habit
          </Button>
        }
      />

      {state.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Create a habit to start tracking streaks."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New habit
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.habits.map((habit) => {
            const { current, best } = computeStreak(habit, state.habitLogs);
            const done = isHabitCompletedOn(habit.id, today, state.habitLogs);
            return (
              <li key={habit.id} className="df-card flex items-center gap-3 p-4">
                <button
                  type="button"
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                  onClick={() =>
                    dispatch({
                      type: "TOGGLE_HABIT_DAY",
                      habitId: habit.id,
                      date: today,
                    })
                  }
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border transition",
                    done
                      ? "border-transparent text-white"
                      : "border-border bg-muted/50",
                  )}
                  style={done ? { background: habit.color ?? "var(--primary)" } : undefined}
                >
                  <HabitIcon name={habit.icon} className="h-5 w-5" />
                </button>
                <Link href={`/habits/${habit.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{habit.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="accent">{current} day streak</Badge>
                    <Badge>Best {best}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New habit" className="sm:max-w-xl">
        <div className="space-y-3">
          <div>
            <Label htmlFor="hname">Name</Label>
            <Input
              id="hname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-1 grid grid-cols-6 gap-2">
              {HABIT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border",
                    icon === ic ? "border-primary bg-primary/10" : "border-border",
                  )}
                  aria-label={ic}
                >
                  <HabitIcon name={ic} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    color === c ? "border-foreground" : "border-transparent",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Specific days</option>
            </Select>
          </div>
          {frequency === "weekly" && (
            <div>
              <Label>Target days</Label>
              <div className="mt-1 flex gap-1">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={`${label}-${i}`}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "h-9 w-9 rounded-lg text-sm font-medium",
                      targetDays.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
