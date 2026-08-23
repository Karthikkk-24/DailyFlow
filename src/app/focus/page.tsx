"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, focusMinutesForEnergy, nowIso } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type TimerState = "idle" | "running" | "paused" | "completed";
const PRESETS = [25, 45, 60];
const CUSTOM_MIN = 1;
const CUSTOM_MAX = 180;
const FOCUS_KEY = "dayflow:focus:session";

type SavedFocus = {
  minutes: number;
  remaining: number;
  timerState: TimerState;
  endAt: number | null;
  startedAt: string | null;
  taskId: string;
  goalId: string;
};

function readSavedFocus(): SavedFocus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedFocus;
  } catch {
    sessionStorage.removeItem(FOCUS_KEY);
    return null;
  }
}

function clampCustomMinutes(value: number) {
  if (!Number.isFinite(value)) return CUSTOM_MIN;
  return Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.round(value)));
}

let tickAudioCtx: AudioContext | null = null;

function playTick() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!tickAudioCtx || tickAudioCtx.state === "closed") {
      tickAudioCtx = new AudioCtx();
    }
    if (tickAudioCtx.state === "suspended") {
      void tickAudioCtx.resume();
    }
    const osc = tickAudioCtx.createOscillator();
    const gain = tickAudioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(tickAudioCtx.destination);
    const now = tickAudioCtx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.stop(now + 0.04);
  } catch {
    // Ignore autoplay / AudioContext failures
  }
}

function initialFocusState(defaultMinutes = 25) {
  const saved = readSavedFocus();
  if (!saved) {
    return {
      minutes: defaultMinutes,
      remaining: defaultMinutes * 60,
      timerState: "idle" as TimerState,
      endAt: null as number | null,
      startedAt: null as string | null,
      taskId: "",
      goalId: "",
      pendingComplete: false,
    };
  }
  if (saved.timerState === "running" && saved.endAt) {
    const left = Math.max(0, Math.round((saved.endAt - Date.now()) / 1000));
    return {
      minutes: saved.minutes,
      remaining: left,
      timerState: (left === 0 ? "completed" : "running") as TimerState,
      endAt: left === 0 ? null : saved.endAt,
      startedAt: saved.startedAt,
      taskId: saved.taskId,
      goalId: saved.goalId,
      pendingComplete: left === 0,
    };
  }
  return {
    minutes: saved.minutes,
    remaining: saved.remaining,
    timerState: saved.timerState,
    endAt: null as number | null,
    startedAt: saved.startedAt,
    taskId: saved.taskId,
    goalId: saved.goalId,
    pendingComplete: false,
  };
}

export default function FocusPage() {
  const { state, dispatch } = useDayFlow();
  const { push } = useToast();
  const [boot] = useState(() =>
    initialFocusState(focusMinutesForEnergy(state.profile.energyPattern)),
  );
  const [minutes, setMinutes] = useState(boot.minutes);
  const [remaining, setRemaining] = useState(boot.remaining);
  const [timerState, setTimerState] = useState<TimerState>(boot.timerState);
  const [taskId, setTaskId] = useState(boot.taskId);
  const [goalId, setGoalId] = useState(boot.goalId);
  const [distractionFree, setDistractionFree] = useState(false);
  const [customDraft, setCustomDraft] = useState(
    PRESETS.includes(boot.minutes) ? "30" : String(boot.minutes),
  );
  const [usingCustom, setUsingCustom] = useState(!PRESETS.includes(boot.minutes));
  const startedAt = useRef<string | null>(boot.startedAt);
  const endAt = useRef<number | null>(boot.endAt);
  const pendingComplete = useRef(boot.pendingComplete);
  const lastTickSecond = useRef<number | null>(null);
  const remainingRef = useRef(boot.remaining);
  const completedOnce = useRef(false);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const complete = useCallback(() => {
    if (completedOnce.current) return;
    completedOnce.current = true;
    setTimerState("completed");
    // Focused time = planned − remaining (pause freezes remaining).
    // Use a ref so the timer tick that hits 0 isn't racing React state.
    const focusedSeconds = Math.max(0, minutes * 60 - remainingRef.current);
    const duration = Math.max(1, Math.round(focusedSeconds / 60));
    dispatch({
      type: "COMPLETE_FOCUS",
      session: {
        durationMinutes: duration,
        startedAt: startedAt.current ?? nowIso(),
        completedAt: nowIso(),
        linkedTaskId: taskId || undefined,
        linkedGoalId: goalId || undefined,
      },
    });
    sessionStorage.removeItem(FOCUS_KEY);
    push(`Focus session complete — ${duration} minutes`, "success");
  }, [dispatch, minutes, taskId, goalId, push]);

  useEffect(() => {
    if (pendingComplete.current) {
      pendingComplete.current = false;
      complete();
    }
  }, [complete]);

  useEffect(() => {
    if (timerState === "idle") return;
    sessionStorage.setItem(
      FOCUS_KEY,
      JSON.stringify({
        minutes,
        remaining,
        timerState,
        endAt: endAt.current,
        startedAt: startedAt.current,
        taskId,
        goalId,
      }),
    );
  }, [minutes, remaining, timerState, taskId, goalId]);

  useEffect(() => {
    if (timerState !== "running") {
      lastTickSecond.current = null;
      return;
    }
    const id = window.setInterval(() => {
      if (!endAt.current) return;
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      remainingRef.current = left;
      setRemaining(left);
      if (
        state.meta.focusTickSound &&
        left > 0 &&
        lastTickSecond.current !== left
      ) {
        lastTickSecond.current = left;
        playTick();
      }
      if (left === 0) {
        window.clearInterval(id);
        complete();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [timerState, complete, state.meta.focusTickSound]);

  useEffect(() => {
    if (timerState === "running" || timerState === "paused") {
      document.title = `${formatTime(remaining)} — Focus · DayFlow`;
    } else if (timerState === "completed") {
      document.title = "Session complete · DayFlow";
    } else {
      document.title = "Focus · DayFlow";
    }
    return () => {
      document.title = "DayFlow — Personal Productivity OS";
    };
  }, [remaining, timerState]);

  function start() {
    startedAt.current = nowIso();
    endAt.current = Date.now() + remaining * 1000;
    setTimerState("running");
  }

  function pause() {
    setTimerState("paused");
    endAt.current = null;
  }

  function resume() {
    endAt.current = Date.now() + remaining * 1000;
    setTimerState("running");
  }

  function reset() {
    setTimerState("idle");
    setRemaining(minutes * 60);
    endAt.current = null;
    startedAt.current = null;
    completedOnce.current = false;
    pendingComplete.current = false;
    sessionStorage.removeItem(FOCUS_KEY);
  }

  const sessionActive =
    timerState === "running" || timerState === "paused";

  function pickPreset(m: number) {
    // Lock duration once a session has started (running or paused).
    if (sessionActive) return;
    setUsingCustom(false);
    setMinutes(m);
    setRemaining(m * 60);
    setTimerState("idle");
  }

  function applyCustom() {
    if (sessionActive) return;
    const m = clampCustomMinutes(Number(customDraft));
    setCustomDraft(String(m));
    setUsingCustom(true);
    setMinutes(m);
    setRemaining(m * 60);
    setTimerState("idle");
  }

  const progress = 1 - remaining / (minutes * 60);

  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8",
        distractionFree &&
          "fixed inset-0 z-[100] max-w-none bg-background px-4 py-8",
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          {!distractionFree && (
            <Link href="/today" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back
            </Link>
          )}
          <h1 className="font-display text-3xl tracking-tight">
            {distractionFree ? "Focus mode" : "Focus"}
          </h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDistractionFree((v) => !v)}
          aria-label={distractionFree ? "Exit distraction-free" : "Enter distraction-free"}
        >
          {distractionFree ? (
            <>
              <X className="h-4 w-4" /> Exit
            </>
          ) : (
            "Distraction-free"
          )}
        </Button>
      </div>

      <div className="df-card flex flex-1 flex-col items-center justify-center p-8">
        <div className="relative mb-8 flex h-56 w-56 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="8"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 90}
              strokeDashoffset={(1 - progress) * 2 * Math.PI * 90}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="text-center">
            <p className="font-display text-5xl tabular-nums tracking-tight">
              {formatTime(remaining)}
            </p>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {timerState === "idle" ? "Ready" : timerState}
            </p>
          </div>
        </div>

        {timerState === "completed" ? (
          <div className="space-y-4 text-center">
            <p className="font-display text-2xl">Nice work</p>
            <p className="text-sm text-muted-foreground">
              Session saved to your analytics.
            </p>
            <Button onClick={reset}>Start another</Button>
          </div>
        ) : (
          <>
            {!distractionFree && timerState === "idle" && (
              <div className="mb-6 flex w-full flex-col items-center gap-3">
                <div className="flex flex-wrap justify-center gap-2">
                  {PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pickPreset(m)}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm",
                        !usingCustom && minutes === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="flex w-full max-w-xs items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="custom-mins">Custom (minutes)</Label>
                    <Input
                      id="custom-mins"
                      type="number"
                      min={CUSTOM_MIN}
                      max={CUSTOM_MAX}
                      value={customDraft}
                      onChange={(e) => setCustomDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCustom();
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant={usingCustom ? "primary" : "secondary"}
                    onClick={applyCustom}
                  >
                    Set
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {CUSTOM_MIN}–{CUSTOM_MAX} minutes
                </p>
              </div>
            )}

            {!distractionFree && timerState !== "running" && (
              <div className="mb-6 grid w-full gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ftask">Link task</Label>
                  <Select
                    id="ftask"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">None</option>
                    {state.tasks
                      .filter((t) => t.status !== "done")
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fgoal">Link goal</Label>
                  <Select
                    id="fgoal"
                    value={goalId}
                    onChange={(e) => setGoalId(e.target.value)}
                  >
                    <option value="">None</option>
                    {state.goals
                      .filter((g) => g.status === "active")
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {timerState === "idle" && (
                <Button size="lg" onClick={start}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}
              {timerState === "running" && (
                <Button size="lg" variant="secondary" onClick={pause}>
                  <Pause className="h-4 w-4" /> Pause
                </Button>
              )}
              {timerState === "paused" && (
                <Button size="lg" onClick={resume}>
                  <Play className="h-4 w-4" /> Resume
                </Button>
              )}
              {sessionActive && minutes * 60 - remaining >= 60 && (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => complete()}
                >
                  End & save
                </Button>
              )}
              {timerState !== "idle" && (
                <Button size="lg" variant="ghost" onClick={reset}>
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
