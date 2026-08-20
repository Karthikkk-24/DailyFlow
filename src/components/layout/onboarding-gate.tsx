"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDayFlow } from "@/context/dayflow-provider";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { state, hydrated } = useDayFlow();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const onOnboarding = pathname.startsWith("/onboarding");
    if (!state.meta.onboardingCompleted && !onOnboarding) {
      router.replace("/onboarding");
    }
  }, [hydrated, state.meta.onboardingCompleted, pathname, router]);

  return <>{children}</>;
}
