"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HabitFormModal,
  HabitIcon,
  type HabitFormValues,
} from "@/components/habits/habit-form-modal";
import { cn, todayKey } from "@/lib/utils";
import {
  computeStreak,
  isHabitCompletedOn,
  isHabitDueOn,
} from "@/lib/analytics/score";
import type { Habit } from "@/types";

export default function HabitsPage() {
  const { state, dispatch } = useDayFlow();
  const today = todayKey();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(habit: Habit) {
    setEditing(habit);
    setOpen(true);
  }

  function save(values: HabitFormValues) {
    if (editing) {
      dispatch({ type: "UPDATE_HABIT", id: editing.id, patch: values });
    } else {
      dispatch({ type: "ADD_HABIT", habit: values });
    }
  }

  return (
    <div>
      <PageHeader
        title="Habits"
        description="Build streaks with daily and weekly habits."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New habit
          </Button>
        }
      />

      {state.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          description="Create a habit to start tracking streaks."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New habit
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.habits.map((habit) => {
            const { current, best } = computeStreak(habit, state.habitLogs);
            const done = isHabitCompletedOn(habit.id, today, state.habitLogs);
            const due = isHabitDueOn(habit, new Date());
            const canToggle = due || done;
            return (
              <li key={habit.id} className="df-card flex items-center gap-3 p-4">
                <button
                  type="button"
                  disabled={!canToggle}
                  aria-label={
                    !due && !done
                      ? "Not due today"
                      : done
                        ? "Mark incomplete"
                        : "Mark complete"
                  }
                  title={!due && !done ? "Not due today" : undefined}
                  onClick={() => {
                    if (!canToggle) return;
                    dispatch({
                      type: "TOGGLE_HABIT_DAY",
                      habitId: habit.id,
                      date: today,
                    });
                  }}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border transition",
                    done
                      ? "border-transparent text-white"
                      : "border-border bg-muted/50",
                    !canToggle && "cursor-not-allowed opacity-45",
                  )}
                  style={
                    done
                      ? { background: habit.color ?? "var(--primary)" }
                      : undefined
                  }
                >
                  <HabitIcon name={habit.icon} className="h-5 w-5" />
                </button>
                <Link href={`/habits/${habit.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{habit.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="accent">{current} day streak</Badge>
                    <Badge>Best {best}</Badge>
                    {!due && <Badge tone="neutral">Not due today</Badge>}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${habit.name}`}
                  onClick={() => openEdit(habit)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <HabitFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        habit={editing}
        onSave={save}
      />
    </div>
  );
}
