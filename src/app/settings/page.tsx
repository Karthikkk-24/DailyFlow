"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDayFlow } from "@/context/dayflow-provider";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { downloadJson, timeToMinutes, cn } from "@/lib/utils";
import { backupCurrentState, parseImportJson } from "@/lib/storage";
import type { AppState, EnergyPattern, ThemeMode } from "@/types";

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

function profileSyncKey(profile: {
  name: string;
  primaryGoal: string;
  workingHours: { start: string; end: string };
  energyPattern: EnergyPattern;
  desiredHabits: string[];
}) {
  return [
    profile.name,
    profile.primaryGoal,
    profile.workingHours.start,
    profile.workingHours.end,
    profile.energyPattern,
    profile.desiredHabits.join(","),
  ].join("\0");
}

export default function SettingsPage() {
  const { state, dispatch } = useDayFlow();
  const { push } = useToast();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const syncKey = profileSyncKey(state.profile);
  const [syncedKey, setSyncedKey] = useState(syncKey);
  const [name, setName] = useState(state.profile.name);
  const [primaryGoal, setPrimaryGoal] = useState(state.profile.primaryGoal);
  const [start, setStart] = useState(state.profile.workingHours.start);
  const [end, setEnd] = useState(state.profile.workingHours.end);
  const [energy, setEnergy] = useState(state.profile.energyPattern);
  const [desiredHabits, setDesiredHabits] = useState<string[]>(state.profile.desiredHabits);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [keepName, setKeepName] = useState(true);
  const [importError, setImportError] = useState("");
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);

  // Resync after import/reset without an effect (React “adjust state during render”).
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setName(state.profile.name);
    setPrimaryGoal(state.profile.primaryGoal);
    setStart(state.profile.workingHours.start);
    setEnd(state.profile.workingHours.end);
    setEnergy(state.profile.energyPattern);
    setDesiredHabits(state.profile.desiredHabits);
  }

  function saveProfile() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      setError("End time must be after start time.");
      return;
    }
    dispatch({
      type: "UPDATE_PROFILE",
      profile: {
        name: name.trim(),
        primaryGoal: primaryGoal.trim(),
        workingHours: { start, end },
        energyPattern: energy,
        desiredHabits,
      },
    });
    setError("");
    push("Profile saved", "success");
  }

  function exportData() {
    downloadJson(`dayflow-export-${new Date().toISOString().slice(0, 10)}.json`, state);
    push("Export downloaded", "success");
  }

  async function onImportFile(file: File) {
    setImportError("");
    const text = await file.text();
    const result = parseImportJson(text);
    if (result.error || !result.data) {
      setImportError(result.error ?? "Import failed");
      push(result.error ?? "Import failed", "error");
      return;
    }
    setPendingImport(result.data);
  }

  function confirmImport() {
    if (!pendingImport) return;
    backupCurrentState();
    dispatch({ type: "REPLACE_STATE", state: pendingImport });
    setPendingImport(null);
    push("Data imported successfully", "success");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile, appearance, and local data controls."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="font-display text-xl">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light, dark, or follow your system.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["light", "dark", "system"] as ThemeMode[]).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => dispatch({ type: "SET_THEME", theme })}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm capitalize",
                  state.meta.theme === theme
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border",
                )}
              >
                {theme}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl">Focus</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional timer feedback. Off by default.
          </p>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={state.meta.focusTickSound}
              onChange={(e) =>
                dispatch({
                  type: "SET_FOCUS_TICK_SOUND",
                  enabled: e.target.checked,
                })
              }
            />
            Play a subtle tick each second while Focus is running
          </label>
        </Card>

        <Card>
          <h2 className="font-display text-xl">Profile</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="sname">Name</Label>
              <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <FieldError>{error}</FieldError>
            </div>
            <div>
              <Label htmlFor="sgoal">Primary goal</Label>
              <Textarea id="sgoal" value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="sstart">Work start</Label>
                <Input id="sstart" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="send">Work end</Label>
                <Input id="send" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div>
                <Label>Energy pattern</Label>
                <Select
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value as EnergyPattern)}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="mixed">Mixed</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>Desired habits</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Preferences from onboarding — edit anytime.
              </p>
              <div className="flex flex-wrap gap-2">
                {HABIT_PRESETS.map((h) => {
                  const on = desiredHabits.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        setDesiredHabits((prev) =>
                          on ? prev.filter((x) => x !== h) : [...prev, h],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={saveProfile}>Save profile</Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl">Onboarding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Replay the first-run setup anytime.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              dispatch({ type: "RESTART_ONBOARDING" });
              router.push("/onboarding");
            }}
          >
            Restart onboarding
          </Button>
        </Card>

        <Card>
          <h2 className="font-display text-xl">Data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything stays in your browser. No account required.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportData}>
              Export JSON
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            <Button variant="danger" onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImportFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <FieldError>{importError}</FieldError>
        </Card>

        <Card>
          <h2 className="font-display text-xl">About</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            DayFlow v0.1.0 — local-first personal productivity OS. Built with
            Next.js, TypeScript, and Tailwind CSS.
          </p>
          <p className="mt-3 text-sm">
            <a
              href="https://github.com/Karthikkk-24/DailyFlow/blob/main/README.md#implemented-features"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Feature checklist
            </a>
            {" · "}
            <a
              href="https://github.com/Karthikkk-24/DailyFlow/issues"
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Open issues
            </a>
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="Replace all local data?"
        description="This will overwrite your current DayFlow data with the imported file. A backup of the previous state will be saved first."
        confirmLabel="Replace data"
        danger
        onConfirm={confirmImport}
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        description="This replaces all local data with a fresh demo set. A backup of the previous export is recommended first."
        confirmLabel="Reset"
        danger
        onConfirm={() => {
          backupCurrentState();
          dispatch({ type: "RESET_DEMO", keepName });
          push("Demo data restored", "success");
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepName}
            onChange={(e) => setKeepName(e.target.checked)}
          />
          Keep my name after reset
        </label>
      </ConfirmDialog>
    </div>
  );
}
