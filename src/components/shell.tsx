"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BriefcaseBusiness, Columns3, Compass, Inbox, Library, Menu, MessagesSquare, Scale, Settings, UserRound } from "lucide-react";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Desk", icon: Compass },
  { href: "/evaluate", label: "Evaluate", icon: BriefcaseBusiness },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tracker", label: "Tracker", icon: Columns3 },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/sources", label: "Sources", icon: Library },
  { href: "/interview", label: "Interview", icon: MessagesSquare },
  { href: "/offers", label: "Offers", icon: Scale },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE = NAV.slice(0, 4);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { notice, setNotice, busy, data, accountEmail } = useApp();
  const fresh = data?.matches.filter((match) => match.status === "new").length ?? 0;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pt-6 pb-4">
          <p className="font-heading text-2xl leading-none">Career Ops</p>
          <p className="mt-1 text-xs tracking-wide text-sidebar-foreground/70">by Vish</p>
          <p className="mt-2 text-xs text-sidebar-foreground/80" suppressHydrationWarning>{accountEmail ?? "Not signed in"}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={isActive(pathname, item.href)} icon={item.icon} count={item.href === "/inbox" ? fresh : 0} />
          ))}
        </nav>
        <p className="px-5 py-4 text-xs leading-5 text-sidebar-foreground/70">Drafts stay here. Nothing is submitted or sent.</p>
      </aside>
      <div className="md:pl-60">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="font-heading text-xl leading-none">Career Ops</p>
            <p className="text-[11px] text-muted-foreground">by Vish</p>
          </div>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Career Ops</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={cn("rounded-lg px-3 py-2 text-sm", isActive(pathname, item.href) && "bg-muted font-medium")}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        {busy || notice ? (
          <div className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <p>{busy || notice}</p>
              {notice && !busy ? (
                <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-8 md:pb-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background md:hidden">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", isActive(pathname, item.href) ? "text-foreground" : "text-muted-foreground")}>
            <item.icon className="size-4" />
            {item.label}
            {item.href === "/inbox" && fresh ? <span className="sr-only">{fresh} new</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NavLink({ href, label, active, icon: Icon, count }: { href: string; label: string; active: boolean; icon: typeof Compass; count: number }) {
  return (
    <Link href={href} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
      <span className="flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
      {count ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{count}</span> : null}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
