# DayFlow

A local-first personal productivity operating system for tasks, habits, goals, weekly planning, focus sessions, and analytics.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · localStorage  
**No backend, auth, paid APIs, or environment variables required.**

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test      # unit tests
npm run build # production build
```

## Architecture

```
src/
  app/                 # Routes (today, tasks, habits, goals, planner, focus, analytics, settings, onboarding)
  components/ui/       # Design system primitives
  components/layout/   # App shell, onboarding gate
  context/             # DayFlowProvider + reducer (single source of truth)
  lib/storage/         # localStorage load/save/import/export
  lib/seed/            # Realistic demo data
  lib/analytics/       # Today score, streaks, insights
  schemas/             # Zod validation for import safety
  types/               # Shared TypeScript models
```

- **State:** One `AppState` object in React context, updated via a typed reducer.
- **Persistence:** Debounced writes to `localStorage` key `dayflow:v1` (backup key on import/reset).
- **Hydration:** Client-only load after mount; skeleton until ready.
- **Cross-feature updates:** Completing tasks, habits, or focus sessions recomputes today’s analytics snapshot and Today score.

### Today score

Weighted average (0–100):

| Component | Weight |
|-----------|--------|
| Task completion | 40% |
| Habit completion | 25% |
| Focus minutes (vs 60m target) | 20% |
| Schedule blocks elapsed | 15% |

## Implemented features

- [x] Onboarding (skippable, repeatable from Settings)
- [x] Today Dashboard with score, tasks, schedule, streaks, goals
- [x] Tasks — list + board, drag-and-drop, filters, search, detail modal
- [x] Habit Tracker — create/edit, daily toggle, streaks, 12-week grid, detail
- [x] Goals — create/edit, milestones, auto progress, active/paused/completed, detail hero
- [x] Weekly Planner — time blocks by category, create/edit/drag across days & hours
- [x] Focus Mode — Pomodoro presets, pause/resume/reset, task/goal link, distraction-free overlay
- [x] Analytics — 7/30 day charts, insights, goal progress over time
- [x] Settings — light/dark/system, profile, export/import JSON (with confirm), reset demo, restart onboarding
- [x] localStorage persistence + seeded demo data (entity-derived analytics history)
- [x] Responsive layout (desktop sidebar, mobile nav + More sheet)
- [x] Unit tests for score, streaks, import validation

### Known gaps

Tracked polish backlog is clear as of this writing. See the [GitHub issue tracker](https://github.com/Karthikkk-24/DailyFlow/issues) for any new work.

## Design

Calm teal/sage primary, warm paper backgrounds, Fraunces + DM Sans typography, light/dark/system themes. Built as one coherent product shell rather than disconnected demos.

## Data

All user data stays in the browser. Use **Settings → Export JSON** for backups. Import validates with Zod and backs up the previous state first.
