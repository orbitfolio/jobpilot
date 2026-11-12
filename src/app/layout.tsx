import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AppProvider } from "@/components/app-state";
import { Shell } from "@/components/shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Career Ops by Vish",
  description: "Score a job against your CV, draft an ATS-friendly CV you can trace, and track the application. Nothing is submitted for you.",
  applicationName: "Career Ops",
  appleWebApp: { capable: true, title: "Career Ops", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#243044",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>
          <AppProvider>
            <Suspense fallback={<div className="p-8 text-sm">Opening the desk…</div>}>
              <Shell>{children}</Shell>
            </Suspense>
          </AppProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
