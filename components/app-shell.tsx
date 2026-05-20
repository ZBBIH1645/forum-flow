"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, GitMerge, Inbox, LayoutDashboard, LayoutGrid, Network, Settings, ShieldCheck, Upload, UsersRound } from "lucide-react";
import { CommandSearch } from "./command-search";
import { EOLogo } from "./eo-logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/placement-queue", label: "Placement Queue", icon: ClipboardList },
  { href: "/shortlist-board", label: "Shortlist Board", icon: LayoutGrid },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/members", label: "Members", icon: UsersRound },
  { href: "/forums", label: "Forum Groups", icon: Network },
  { href: "/free-agents", label: "Free Agents", icon: UsersRound },
  { href: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { href: "/intake-review", label: "Intake Review", icon: Inbox },
  { href: "/import-data", label: "Import Data", icon: Upload },
  { href: "/duplicate-review", label: "Duplicate Review", icon: GitMerge },
  { href: "/admin-tools", label: "Admin Tools", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-cloud">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-white/95 backdrop-blur lg:block">
        <div className="flex h-full flex-col">
          <Link href="/" aria-label="Forum Placement Dashboard home" className="block border-b border-line px-6 py-6">
            <EOLogo compact />
          </Link>
          <nav aria-label="Admin navigation" className="space-y-1 px-4 py-4">
            <div className="pb-3">
              <CommandSearch />
            </div>
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-eo-purple text-white shadow-card" : "text-slate-600 hover:bg-eo-lilac hover:text-eo-purple"
                  }`}
                >
                  <span className={`h-5 w-1 rounded-full ${active ? "bg-white" : "bg-transparent group-hover:bg-eo-purple/30"}`} />
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto p-4">
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">Decision support</p>
              <p className="mt-1 text-xs leading-5 text-muted">Compatibility labels support, but never replace, placement judgment.</p>
            </div>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-base font-semibold text-ink">Forum Placement Dashboard</Link>
          <div className="flex gap-2">
            <div className="w-28">
              <CommandSearch enableShortcut={false} />
            </div>
            <Link href="/placement-queue" className="rounded-lg bg-eo-purple px-3 py-2 text-sm font-semibold text-white">Queue</Link>
            <Link href="/reports" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">Reports</Link>
          </div>
        </div>
      </header>
      <main className="lg:pl-72">{children}</main>
    </div>
  );
}
