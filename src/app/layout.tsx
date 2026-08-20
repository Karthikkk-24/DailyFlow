import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { DayFlowProvider } from "@/context/dayflow-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingGate } from "@/components/layout/onboarding-gate";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DayFlow — Personal Productivity OS",
  description:
    "A local-first personal productivity operating system for tasks, habits, goals, focus, and planning.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${sans.variable} ${display.variable} min-h-full font-sans antialiased`}
      >
        <DayFlowProvider>
          <ToastProvider>
            <OnboardingGate>
              <AppShell>{children}</AppShell>
            </OnboardingGate>
          </ToastProvider>
        </DayFlowProvider>
      </body>
    </html>
  );
}
