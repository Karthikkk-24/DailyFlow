import type {
  AnalyticsSnapshot,
  AppState,
  FocusSession,
  Goal,
  Habit,
  HabitLog,
  ScheduleBlock,
  Task,
  UserProfile,
} from "@/types";
import { createId, nowIso, todayKey, weekDates, timeToMinutes, minutesToTime } from "@/lib/utils";
import { format, subDays, addDays, getDay } from "date-fns";
import { recomputeTodaySnapshot } from "@/lib/analytics/score";

function deepWorkBlocksForWorkingHours(profile: UserProfile): ScheduleBlock[] {
  const startMin = timeToMinutes(profile.workingHours.start);
  const endMin = timeToMinutes(profile.workingHours.end);
  if (endMin <= startMin) return [];

  const blockEnd = minutesToTime(Math.min(endMin, startMin + 120));
  return weekDates(new Date(), 1)
    .filter((d) => {
      const dow = getDay(d);
      return dow >= 1 && dow <= 5;
    })
    .map((d) => ({
      id: createId("blk"),
      title: "Deep work",
      category: "deep_work" as const,
      date: format(d, "yyyy-MM-dd"),
      startTime: profile.workingHours.start,
      endTime: blockEnd,
      notes: "Seeded from your preferred working hours",
    }));
}

function defaultProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    name: "Alex",
    primaryGoal: "Build a sustainable deep-work routine",
    workingHours: { start: "09:00", end: "17:30" },
    energyPattern: "morning",
    desiredHabits: ["Morning stretch", "Read 20 pages", "Walk outside"],
    ...overrides,
  };
}

export function createEmptyState(
  profileOverrides?: Partial<UserProfile>,
): AppState {
  const now = nowIso();
  return {
    version: 1,
    meta: {
      createdAt: now,
      updatedAt: now,
      onboardingCompleted: false,
      theme: "system",
    },
    profile: defaultProfile(profileOverrides),
    tasks: [],
    habits: [],
    habitLogs: [],
    goals: [],
    scheduleBlocks: [],
    focusSessions: [],
    analyticsSnapshots: [],
  };
}

export function createSeededState(
  profileOverrides?: Partial<UserProfile>,
): AppState {
  const now = nowIso();
  const today = todayKey();
  const profile = defaultProfile(profileOverrides);

  const habits: Habit[] = [
    {
      id: createId("hab"),
      name: "Morning stretch",
      icon: "Sunrise",
      color: "#0D9488",
      frequency: "daily",
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now,
    },
    {
      id: createId("hab"),
      name: "Read 20 pages",
      icon: "BookOpen",
      color: "#2563EB",
      frequency: "daily",
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now,
    },
    {
      id: createId("hab"),
      name: "Exercise",
      icon: "Dumbbell",
      color: "#16A34A",
      frequency: "weekly",
      targetDays: [1, 3, 5],
      createdAt: now,
    },
    {
      id: createId("hab"),
      name: "Drink water goal",
      icon: "Droplets",
      color: "#0891B2",
      frequency: "daily",
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now,
    },
    {
      id: createId("hab"),
      name: "Journal",
      icon: "Pencil",
      color: "#7C3AED",
      frequency: "weekly",
      targetDays: [0, 2, 4, 6],
      createdAt: now,
    },
  ];

  const habitLogs: HabitLog[] = [];
  for (let i = 1; i <= 45; i++) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const dow = getDay(subDays(new Date(), i));
    for (const habit of habits) {
      const due =
        habit.frequency === "daily" || habit.targetDays.includes(dow);
      if (!due) continue;
      // ~75% completion with some gaps for realism
      if (Math.sin(i * habit.name.length) > -0.4) {
        habitLogs.push({ habitId: habit.id, date, completed: true });
      }
    }
  }
  // Mark a couple done today
  habitLogs.push(
    { habitId: habits[0].id, date: today, completed: true },
    { habitId: habits[3].id, date: today, completed: true },
  );

  const tasks: Task[] = [
    {
      id: createId("task"),
      title: "Outline Q3 personal OKRs",
      description: "Capture three outcomes and supporting habits.",
      status: "today",
      priority: "high",
      category: "Work",
      dueDate: today,
      dueTime: "11:00",
      createdAt: now,
      updatedAt: now,
      order: 0,
    },
    {
      id: createId("task"),
      title: "Deep-work block: write proposal",
      status: "in_progress",
      priority: "high",
      category: "Work",
      dueDate: today,
      dueTime: "14:00",
      createdAt: now,
      updatedAt: now,
      order: 1,
    },
    {
      id: createId("task"),
      title: "Grocery run",
      status: "today",
      priority: "medium",
      category: "Errands",
      dueDate: today,
      dueTime: "18:30",
      createdAt: now,
      updatedAt: now,
      order: 2,
    },
    {
      id: createId("task"),
      title: "Review weekly budget",
      status: "backlog",
      priority: "medium",
      category: "Personal",
      dueDate: format(addDays(new Date(), 2), "yyyy-MM-dd"),
      createdAt: now,
      updatedAt: now,
      order: 0,
    },
    {
      id: createId("task"),
      title: "Finish TypeScript course module",
      status: "backlog",
      priority: "low",
      category: "Learning",
      createdAt: now,
      updatedAt: now,
      order: 1,
    },
    {
      id: createId("task"),
      title: "Book dentist appointment",
      status: "backlog",
      priority: "medium",
      category: "Health",
      createdAt: now,
      updatedAt: now,
      order: 2,
    },
    {
      id: createId("task"),
      title: "Send thank-you note",
      status: "done",
      priority: "low",
      category: "Personal",
      dueDate: today,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      order: 0,
    },
    {
      id: createId("task"),
      title: "Morning inbox zero",
      status: "done",
      priority: "medium",
      category: "Work",
      dueDate: today,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
      order: 1,
    },
  ];

  // more backlog variety
  for (let i = 0; i < 7; i++) {
    tasks.push({
      id: createId("task"),
      title: [
        "Research standing desk options",
        "Plan weekend hike",
        "Organize photo library",
        "Update LinkedIn headline",
        "Sketch app icon ideas",
        "Call family",
        "Prep meal plan",
      ][i],
      status: i % 3 === 0 ? "today" : "backlog",
      priority: (["low", "medium", "high"] as const)[i % 3],
      category: ["Personal", "Health", "Work", "Learning", "Errands"][i % 5],
      dueDate:
        i % 2 === 0
          ? format(addDays(new Date(), i), "yyyy-MM-dd")
          : undefined,
      createdAt: now,
      updatedAt: now,
      order: 10 + i,
    });
  }

  const goals: Goal[] = [
    {
      id: createId("goal"),
      title: "Ship personal website redesign",
      description: "A calm portfolio that reflects my craft.",
      category: "Work",
      targetDate: format(addDays(new Date(), 45), "yyyy-MM-dd"),
      status: "active",
      milestones: [
        { id: createId("ms"), title: "Define information architecture", completed: true, completedAt: now },
        { id: createId("ms"), title: "Design homepage", completed: true, completedAt: now },
        { id: createId("ms"), title: "Build case study templates", completed: false },
        { id: createId("ms"), title: "Launch and share", completed: false },
      ],
      createdAt: now,
    },
    {
      id: createId("goal"),
      title: "Run a half marathon",
      description: "Build endurance with a steady plan.",
      category: "Health",
      targetDate: format(addDays(new Date(), 90), "yyyy-MM-dd"),
      status: "active",
      milestones: [
        { id: createId("ms"), title: "Complete base training", completed: true, completedAt: now },
        { id: createId("ms"), title: "Long run 15k", completed: false },
        { id: createId("ms"), title: "Race day", completed: false },
      ],
      createdAt: now,
    },
    {
      id: createId("goal"),
      title: "Read 24 books this year",
      category: "Learning",
      status: "paused",
      milestones: [
        { id: createId("ms"), title: "Finish 12 books", completed: true, completedAt: now },
        { id: createId("ms"), title: "Finish 18 books", completed: false },
        { id: createId("ms"), title: "Finish 24 books", completed: false },
      ],
      createdAt: now,
    },
    {
      id: createId("goal"),
      title: "Set up home office",
      category: "Personal",
      status: "completed",
      milestones: [
        { id: createId("ms"), title: "Buy desk", completed: true, completedAt: now },
        { id: createId("ms"), title: "Cable management", completed: true, completedAt: now },
        { id: createId("ms"), title: "Lighting upgrade", completed: true, completedAt: now },
      ],
      createdAt: now,
    },
  ];

  const scheduleBlocks: ScheduleBlock[] = [];
  for (let d = 0; d < 7; d++) {
    const date = format(addDays(new Date(), d - getDay(new Date()) + 1), "yyyy-MM-dd");
    if (d === 5 || d === 6) {
      scheduleBlocks.push({
        id: createId("blk"),
        title: "Weekend reset",
        category: "personal",
        date,
        startTime: "10:00",
        endTime: "11:30",
      });
      continue;
    }
    scheduleBlocks.push(
      {
        id: createId("blk"),
        title: "Deep work",
        category: "deep_work",
        date,
        startTime: "09:00",
        endTime: "11:00",
      },
      {
        id: createId("blk"),
        title: "Team sync",
        category: "meetings",
        date,
        startTime: "11:30",
        endTime: "12:00",
      },
      {
        id: createId("blk"),
        title: d % 2 === 0 ? "Gym" : "Walk",
        category: "exercise",
        date,
        startTime: "17:30",
        endTime: "18:30",
      },
    );
  }

  const focusSessions: FocusSession[] = [];
  for (let i = 1; i <= 22; i++) {
    const day = subDays(new Date(), i);
    const started = new Date(day);
    started.setHours(9 + (i % 4), 0, 0, 0);
    const mins = [25, 45, 60, 25][i % 4];
    focusSessions.push({
      id: createId("focus"),
      durationMinutes: mins,
      startedAt: started.toISOString(),
      completedAt: new Date(started.getTime() + mins * 60000).toISOString(),
      linkedTaskId: i % 3 === 0 ? tasks[0].id : undefined,
    });
  }

  const analyticsSnapshots: AnalyticsSnapshot[] = [];
  for (let i = 30; i >= 1; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const tasksCompleted = 2 + ((i * 3) % 5);
    const habitsTotal = 4;
    const habitsCompleted = 2 + (i % 3);
    const focusMinutes = 25 + ((i * 7) % 90);
    const scheduleBlocksCompleted = 1 + (i % 3);
    const taskRate = Math.min(1, tasksCompleted / 5);
    const habitRate = habitsCompleted / habitsTotal;
    const focusScore = Math.min(1, focusMinutes / 60);
    const scheduleScore = scheduleBlocksCompleted / 3;
    const todayScore = Math.round(
      (taskRate * 0.4 + habitRate * 0.25 + focusScore * 0.2 + scheduleScore * 0.15) *
        100,
    );
    analyticsSnapshots.push({
      date,
      tasksCompleted,
      habitsCompleted,
      habitsTotal,
      focusMinutes,
      scheduleBlocksCompleted,
      todayScore,
    });
  }

  let state: AppState = {
    version: 1,
    meta: {
      createdAt: now,
      updatedAt: now,
      onboardingCompleted: true,
      theme: "system",
    },
    profile,
    tasks,
    habits,
    habitLogs,
    goals,
    scheduleBlocks,
    focusSessions,
    analyticsSnapshots,
  };

  const todaySnap = recomputeTodaySnapshot(state);
  state = {
    ...state,
    analyticsSnapshots: [
      ...state.analyticsSnapshots.filter((s) => s.date !== todaySnap.date),
      todaySnap,
    ],
  };

  return state;
}

export function personalizeAfterOnboarding(
  base: AppState,
  profile: UserProfile,
): AppState {
  const now = nowIso();
  const existingNames = new Set(base.habits.map((h) => h.name.toLowerCase()));
  const icons = ["Sunrise", "BookOpen", "Dumbbell", "Leaf", "Brain", "Heart"];
  const colors = ["#0D9488", "#2563EB", "#16A34A", "#7C3AED", "#EA580C", "#CA8A04"];
  const newHabits: Habit[] = profile.desiredHabits
    .filter((n) => n.trim() && !existingNames.has(n.trim().toLowerCase()))
    .slice(0, 6)
    .map((name, i) => ({
      id: createId("hab"),
      name: name.trim(),
      icon: icons[i % icons.length],
      color: colors[i % colors.length],
      frequency: "daily" as const,
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      createdAt: now,
    }));

  const seededBlocks = deepWorkBlocksForWorkingHours(profile);
  const occupied = new Set(
    base.scheduleBlocks
      .filter((b) => b.category === "deep_work")
      .map((b) => b.date),
  );
  const newBlocks = seededBlocks.filter((b) => !occupied.has(b.date));

  return {
    ...base,
    profile,
    habits: [...base.habits, ...newHabits],
    scheduleBlocks: [...base.scheduleBlocks, ...newBlocks],
    meta: {
      ...base.meta,
      onboardingCompleted: true,
      updatedAt: now,
    },
  };
}
