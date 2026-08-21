import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  isToday,
  isSameDay,
} from "date-fns";
import type { EnergyPattern } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix?: string) {
  return prefix ? `${prefix}_${nanoid(10)}` : nanoid(12);
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayKey(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "EEEE, MMMM d");
}

export function formatShortDate(date: Date | string) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d");
}

export function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Suggested Focus preset minutes based on declared energy pattern. */
export function focusMinutesForEnergy(pattern: EnergyPattern): number {
  switch (pattern) {
    case "morning":
      return 45;
    case "afternoon":
      return 25;
    case "evening":
      return 25;
    case "mixed":
      return 30;
  }
}

/** Short Today tip that uses energyPattern relative to the current hour. */
export function energyGuidance(pattern: EnergyPattern, hour: number): string {
  const inMorning = hour < 12;
  const inAfternoon = hour >= 12 && hour < 17;
  const inEvening = hour >= 17;

  switch (pattern) {
    case "morning":
      return inMorning
        ? "Morning energy — protect a deep-work block before noon."
        : "You peak in the mornings; keep remaining work light or prep tomorrow.";
    case "afternoon":
      return inAfternoon
        ? "Afternoon peak — schedule focus or hard tasks now."
        : inMorning
          ? "Ease in this morning; save deep work for after lunch."
          : "Wind down — your strongest hours were earlier today.";
    case "evening":
      return inEvening
        ? "Evening energy — a solid Focus session still fits tonight."
        : "Save demanding focus for later; keep mornings lighter.";
    case "mixed":
      return "Energy varies — pick a Focus length that matches how you feel right now.";
  }
}

export function weekDates(anchor = new Date(), weekStartsOn: 0 | 1 = 1) {
  const start = startOfWeek(anchor, { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isDateToday(date: string) {
  return isToday(parseISO(date));
}

export function sameDay(a: string, b: string) {
  return isSameDay(parseISO(a), parseISO(b));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
