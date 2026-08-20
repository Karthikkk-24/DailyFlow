"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useDayFlow } from "@/context/dayflow-provider";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { cn, nowIso } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type TimerState = "idle" | "running" | "paused" | "completed";
const PRESETS = [25, 45, 60];
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

function initialFocusState() {
  const saved = readSavedFocus();
  if (!saved) {
    return {
      minutes: 25,
      remaining: 25 * 60,
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
  const [boot] = useState(() => initialFocusState());
  const [minutes, setMinutes] = useState(boot.minutes);
  const [remaining, setRemaining] = useState(boot.remaining);
  const [timerState, setTimerState] = useState<TimerState>(boot.timerState);
  const [taskId, setTaskId] = useState(boot.taskId);
  const [goalId, setGoalId] = useState(boot.goalId);
  const [distractionFree, setDistractionFree] = useState(false);
  const startedAt = useRef<string | null>(boot.startedAt);
  const endAt = useRef<number | null>(boot.endAt);
  const pendingComplete = useRef(boot.pendingComplete);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const complete = useCallback(() => {
    setTimerState("completed");
    const duration = minutes;
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
    if (timerState !== "running") return;
    const id = window.setInterval(() => {
      if (!endAt.current) return;
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(id);
        complete();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [timerState, complete]);

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
    sessionStorage.removeItem(FOCUS_KEY);
  }

  function pickPreset(m: number) {
    if (timerState === "running") return;
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
              <div className="mb-6 flex gap-2">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickPreset(m)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm",
                      minutes === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {m}m
                  </button>
                ))}
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
