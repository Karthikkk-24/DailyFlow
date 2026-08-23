"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Flame,
  Home,
  Menu,
  MoreHorizontal,
  Settings,
  Target,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useDayFlow } from "@/context/dayflow-provider";
import { Skeleton } from "@/components/ui/card";
import { FocusSessionWatcher } from "@/components/focus/focus-session-watcher";

const NAV = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIMARY = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/focus", label: "Focus", icon: Timer },
] as const;

const MOBILE_MORE = [
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, state, storageError } = useDayFlow();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const morePrevFocus = useRef<HTMLElement | null>(null);
  const hideChrome = pathname.startsWith("/onboarding");
  const moreActive = MOBILE_MORE.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    if (!moreOpen) return;
    morePrevFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = morePanelRef.current;
    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
          )
        : [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMoreOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Defer focus until after paint so the panel is mounted.
    const t = window.setTimeout(() => {
      const items = focusables();
      (items[0] ?? panel)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      morePrevFocus.current?.focus();
    };
  }, [moreOpen]);

  if (!hydrated) {
    return (
      <div className="df-surface flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (hideChrome) {
    return <div className="df-surface min-h-screen">{children}</div>;
  }

  return (
    <div className="df-surface min-h-screen">
      <FocusSessionWatcher />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
        <Link href="/today" className="mb-8 px-3">
          <span className="font-display text-2xl tracking-tight text-foreground">
            DayFlow
          </span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your productivity OS
          </p>
        </Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-muted/70 px-3 py-3 text-xs text-muted-foreground">
          Hi, {state.profile.name || "friend"}
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/today" className="font-display text-xl">
            DayFlow
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-muted"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <nav className="absolute right-0 top-0 flex h-full w-64 flex-col gap-1 border-l border-border bg-sidebar p-4">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-sidebar-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {storageError && (
          <div className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
            {storageError}
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur lg:hidden"
        aria-label="Mobile"
      >
        {MOBILE_PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
            moreActive || moreOpen ? "text-primary" : "text-muted-foreground",
          )}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 bg-black/40"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            ref={morePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-4 pb-8 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg">More</h2>
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-muted"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
