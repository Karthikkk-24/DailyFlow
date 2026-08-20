"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDayFlow } from "@/context/dayflow-provider";

export default function HomePage() {
  const { state, hydrated } = useDayFlow();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(
      state.meta.onboardingCompleted ? "/today" : "/onboarding",
    );
  }, [hydrated, state.meta.onboardingCompleted, router]);

  return null;
}
