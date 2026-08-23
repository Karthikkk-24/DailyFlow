import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { DayFlowProvider } from "@/context/dayflow-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingGate } from "@/components/layout/onboarding-gate";
import { STORAGE_KEY } from "@/lib/storage";

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

/** Runs before paint so saved dark/system theme does not flash light. */
const themeBootstrapScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var theme="system";if(raw){var data=JSON.parse(raw);if(data&&data.meta&&typeof data.meta.theme==="string")theme=data.meta.theme;}var dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",!!dark);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
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
