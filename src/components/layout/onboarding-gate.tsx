"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDayFlow } from "@/context/dayflow-provider";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { state, hydrated } = useDayFlow();
  const pathname = usePathname();
  const router = useRouter();
  const onOnboarding = pathname.startsWith("/onboarding");
  const needsOnboarding = hydrated && !state.meta.onboardingCompleted;
  const finishedOnWizard = hydrated && state.meta.onboardingCompleted && onOnboarding;

  useEffect(() => {
    if (!hydrated) return;
    if (needsOnboarding && !onOnboarding) {
      router.replace("/onboarding");
      return;
    }
    // Finished users shouldn't re-enter the wizard via URL (Settings restart clears the flag first).
    if (finishedOnWizard) {
      router.replace("/today");
    }
  }, [hydrated, needsOnboarding, onOnboarding, finishedOnWizard, router]);

  if (!hydrated) return null;
  // Avoid flashing AppShell chrome before redirect to the wizard.
  if (needsOnboarding && !onOnboarding) return null;
  if (finishedOnWizard) return null;

  return <>{children}</>;
}
