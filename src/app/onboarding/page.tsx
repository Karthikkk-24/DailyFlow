"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { useDayFlow } from "@/context/dayflow-provider";
import type { EnergyPattern, UserProfile } from "@/types";
import { cn, timeToMinutes } from "@/lib/utils";

const HABIT_PRESETS = [
  "Morning stretch",
  "Read 20 pages",
  "Walk outside",
  "Meditate",
  "Drink water",
  "No phone first hour",
  "Journal",
  "Strength training",
];

const ENERGY: { value: EnergyPattern; label: string; hint: string }[] = [
  { value: "morning", label: "Morning", hint: "Sharpest before noon" },
  { value: "afternoon", label: "Afternoon", hint: "Peak after lunch" },
  { value: "evening", label: "Evening", hint: "Creative after dark" },
  { value: "mixed", label: "Mixed", hint: "Varies day to day" },
];

export default function OnboardingPage() {
  const { state, dispatch } = useDayFlow();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.profile.name === "Alex" ? "" : state.profile.name);
  const [primaryGoal, setPrimaryGoal] = useState(state.profile.primaryGoal);
  const [start, setStart] = useState(state.profile.workingHours.start);
  const [end, setEnd] = useState(state.profile.workingHours.end);
  const [energy, setEnergy] = useState<EnergyPattern>(state.profile.energyPattern);
  const [habits, setHabits] = useState<string[]>(state.profile.desiredHabits);
  const [customHabit, setCustomHabit] = useState("");
  const [error, setError] = useState("");

  const total = 5;
  const progress = ((step + 1) / total) * 100;

  const profile: UserProfile = useMemo(
    () => ({
      name: name.trim() || "Friend",
      primaryGoal: primaryGoal.trim(),
      workingHours: { start, end },
      energyPattern: energy,
      desiredHabits: habits,
    }),
    [name, primaryGoal, start, end, energy, habits],
  );

  function skip() {
    dispatch({ type: "SKIP_ONBOARDING" });
    router.replace("/today");
  }

  function finish() {
    if (!name.trim()) {
      setError("Please enter your name.");
      setStep(0);
      return;
    }
    dispatch({ type: "COMPLETE_ONBOARDING", profile });
    router.replace("/today");
  }

  function next() {
    setError("");
    if (step === 0 && !name.trim()) {
      setError("Name is required.");
      return;
    }
    if (step === 2) {
      if (timeToMinutes(end) <= timeToMinutes(start)) {
        setError("End time must be after start time.");
        return;
      }
    }
    if (step === total - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function toggleHabit(h: string) {
    setHabits((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h],
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Welcome</p>
          <h1 className="font-display text-3xl tracking-tight">DayFlow</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={skip}>
          Skip for now
        </Button>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="df-card flex-1 p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl">What should we call you?</h2>
            <p className="text-sm text-muted-foreground">
              Your name personalizes greetings across DayFlow.
            </p>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                autoFocus
                maxLength={80}
              />
              <FieldError>{error}</FieldError>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl">What&apos;s your primary goal?</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll surface this on your dashboard for daily focus.
            </p>
            <div>
              <Label htmlFor="goal">Primary goal</Label>
              <Textarea
                id="goal"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                placeholder="Build a sustainable deep-work routine"
                maxLength={500}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl">Preferred working hours</h2>
            <p className="text-sm text-muted-foreground">
              Used to shape your planner defaults.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <FieldError>{error}</FieldError>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 id="energy-heading" className="font-display text-2xl">
              When is your energy highest?
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="energy-heading"
              className="grid gap-2 sm:grid-cols-2"
            >
              {ENERGY.map((opt, index) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={energy === opt.value}
                  tabIndex={energy === opt.value ? 0 : -1}
                  onClick={() => setEnergy(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setEnergy(opt.value);
                      return;
                    }
                    const last = ENERGY.length - 1;
                    let next = index;
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                      next = index === last ? 0 : index + 1;
                    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                      next = index === 0 ? last : index - 1;
                    } else if (e.key === "Home") {
                      next = 0;
                    } else if (e.key === "End") {
                      next = last;
                    } else {
                      return;
                    }
                    e.preventDefault();
                    setEnergy(ENERGY[next]!.value);
                    const radios =
                      e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
                        '[role="radio"]',
                      );
                    radios?.[next]?.focus();
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    energy === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl">Habits you want to build</h2>
            <p className="text-sm text-muted-foreground">
              Pick a few — we&apos;ll add them to your tracker.
            </p>
            <div className="flex flex-wrap gap-2">
              {HABIT_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHabit(h)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    habits.includes(h)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customHabit}
                onChange={(e) => setCustomHabit(e.target.value)}
                placeholder="Add a custom habit"
                maxLength={80}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customHabit.trim()) {
                    e.preventDefault();
                    toggleHabit(customHabit.trim());
                    setCustomHabit("");
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!customHabit.trim()) return;
                  toggleHabit(customHabit.trim());
                  setCustomHabit("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          <Button onClick={next}>
            {step === total - 1 ? "Start DayFlow" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
