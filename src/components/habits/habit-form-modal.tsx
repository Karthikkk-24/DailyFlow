"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  HABIT_COLORS,
  HABIT_ICONS,
  type Habit,
  type HabitFrequency,
} from "@/types";
import { MAX_HABITS } from "@/schemas/app-state.schema";

function HabitIcon({ name, className }: { name: string; className?: string }) {
  const icons = Icons as unknown as Record<
    string,
    React.ComponentType<{ className?: string }>
  >;
  const Icon = icons[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type HabitFormValues = {
  name: string;
  icon: string;
  color?: string;
  frequency: HabitFrequency;
  targetDays: number[];
};

function defaultsFromHabit(habit?: Habit | null): HabitFormValues {
  if (!habit) {
    return {
      name: "",
      icon: HABIT_ICONS[0],
      color: HABIT_COLORS[0],
      frequency: "daily",
      targetDays: [0, 1, 2, 3, 4, 5, 6],
    };
  }
  return {
    name: habit.name,
    icon: habit.icon,
    color: habit.color ?? HABIT_COLORS[0],
    frequency: habit.frequency,
    targetDays: [...habit.targetDays],
  };
}

function HabitFormFields({
  habit,
  atCap,
  onClose,
  onSave,
}: {
  habit?: Habit | null;
  atCap?: boolean;
  onClose: () => void;
  onSave: (values: HabitFormValues) => void;
}) {
  const initial = defaultsFromHabit(habit);
  const [name, setName] = useState(initial.name);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  const [frequency, setFrequency] = useState<HabitFrequency>(initial.frequency);
  const [targetDays, setTargetDays] = useState<number[]>(initial.targetDays);
  const [error, setError] = useState("");

  function toggleDay(d: number) {
    setTargetDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  function save() {
    if (!habit && atCap) {
      setError(`You can have at most ${MAX_HABITS} habits.`);
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const days =
      frequency === "daily" ? [0, 1, 2, 3, 4, 5, 6] : targetDays;
    if (days.length === 0) {
      setError("Pick at least one target day.");
      return;
    }
    onSave({
      name: name.trim(),
      icon,
      color,
      frequency,
      targetDays: days,
    });
    onClose();
  }

  return (
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
            {DAY_LABELS.map((label, i) => {
              const pressed = targetDays.includes(i);
              return (
              <button
                key={`${label}-${i}`}
                type="button"
                onClick={() => toggleDay(i)}
                aria-label={DAY_NAMES[i]}
                aria-pressed={pressed}
                className={cn(
                  "h-9 w-9 rounded-lg text-sm font-medium",
                  pressed
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </button>
            );
            })}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save}>{habit ? "Save" : "Create"}</Button>
      </div>
    </div>
  );
}

export function HabitFormModal({
  open,
  onClose,
  habit,
  atCap,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit | null;
  atCap?: boolean;
  onSave: (values: HabitFormValues) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      className="sm:max-w-xl"
    >
      {open && (
        <HabitFormFields
          key={habit?.id ?? "new"}
          habit={habit}
          atCap={atCap}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}

export { HabitIcon };
