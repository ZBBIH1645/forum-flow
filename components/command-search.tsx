"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileText, Search, UserRound, X } from "lucide-react";
import { ForumBadge } from "./forum-badge";
import { StatusBadge } from "./status-badge";
import { useLiveData } from "./live-data-provider";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms } from "@/lib/search";

const pages = [
  { href: "/dashboard", label: "Dashboard", detail: "Overview and forum seat map" },
  { href: "/placement-queue", label: "Placement Queue", detail: "Daily member workflow" },
  { href: "/shortlist-board", label: "Shortlist Board", detail: "Forum shortlists and candidate comparison" },
  { href: "/reports", label: "Reports", detail: "Exports and executive summaries" },
  { href: "/members", label: "Members", detail: "Member directory" },
  { href: "/forums", label: "Forum Groups", detail: "Capacity and forum composition" },
  { href: "/free-agents", label: "Free Agents", detail: "Unassigned member pool" },
  { href: "/data-quality", label: "Data Quality", detail: "Missing fields, stale records, and review flags" },
  { href: "/intake-review", label: "Intake Review", detail: "Review member intake submissions" },
  { href: "/import-data", label: "Import Data", detail: "CSV import workflow" },
  { href: "/duplicate-review", label: "Duplicate Review", detail: "Review possible duplicate member records" },
  { href: "/members/new", label: "Add Member", detail: "Create a new member record" },
  { href: "/intake", label: "Open Member Intake", detail: "Public-facing member intake form" }
];

export function CommandSearch({ enableShortcut = true }: { enableShortcut?: boolean }) {
  const { members, forums, getEffectiveStatus } = useLiveData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!enableShortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableShortcut]);

  const normalized = sanitizeSingleLine(query, inputLimits.search).trim().toLowerCase();
  const results = useMemo(() => {
    const pageResults = pages
      .filter((page) => !normalized || `${page.label} ${page.detail}`.toLowerCase().includes(normalized))
      .slice(0, 6);
    const memberResults = members
      .filter((member) => !normalized || [member.name, member.company, member.industry, member.homeLocation, member.businessLocation].some((value) => value.toLowerCase().includes(normalized)))
      .slice(0, 7);
    const forumResults = forums
      .filter((forum) => !normalized || [forum.name, forum.mainLocationZone, forum.forumStyle, forum.groupNotes].some((value) => value.toLowerCase().includes(normalized)))
      .slice(0, 7);
    return { pageResults, memberResults, forumResults };
  }, [forums, members, normalized]);
  const searchTerms = useMemo(() => [
    ...pages.flatMap((page) => [page.label, page.detail]),
    ...getSearchableTerms({ members, forums })
  ], [forums, members]);
  const resultCount = results.pageResults.length + results.memberResults.length + results.forumResults.length;
  const suggestions = useMemo(() => resultCount === 0 ? getFuzzySuggestions(query, searchTerms) : [], [query, resultCount, searchTerms]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-card transition hover:border-eo-blue hover:text-ink"
      >
        <Search className="h-4 w-4" />
        Search
        {enableShortcut ? <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/35 px-4 py-16" role="dialog" aria-modal="true" aria-label="Global search">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-line bg-white shadow-soft">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
                placeholder="Search members, forums, pages, and actions"
                className="h-10 flex-1 border-0 bg-transparent text-sm text-ink outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-3">
              <ResultSection title="Pages and actions">
                {results.pageResults.map((page) => (
                  <ResultLink key={page.href} href={page.href} icon={<FileText className="h-4 w-4" />} onSelect={() => setOpen(false)}>
                    <span className="font-semibold text-ink">{page.label}</span>
                    <span className="text-xs text-muted">{page.detail}</span>
                  </ResultLink>
                ))}
              </ResultSection>

              <ResultSection title="Members">
                {results.memberResults.map((member) => (
                  <ResultLink key={member.id} href={`/members/${member.id}`} icon={<UserRound className="h-4 w-4" />} onSelect={() => setOpen(false)}>
                    <span className="font-semibold text-ink">{member.name}</span>
                    <span className="text-xs text-muted">{member.company} · {member.industry}</span>
                    <StatusBadge status={getEffectiveStatus(member)} />
                  </ResultLink>
                ))}
              </ResultSection>

              <ResultSection title="Forums">
                {results.forumResults.map((forum) => (
                  <ResultLink key={forum.id} href={`/forums/${forum.id}`} icon={<Building2 className="h-4 w-4" />} onSelect={() => setOpen(false)}>
                    <ForumBadge forumId={forum.id} name={forum.name} />
                    <span className="text-xs text-muted">{forum.mainLocationZone} · {forum.forumStyle}</span>
                  </ResultLink>
                ))}
              </ResultSection>
              {resultCount === 0 ? (
                <div className="px-2 py-8 text-center">
                  <p className="text-sm font-semibold text-ink">No results found</p>
                  {suggestions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
                      <span>Did you mean</span>
                      {suggestions.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="font-semibold text-eo-blue hover:text-eo-purple">
                          {suggestion}
                        </button>
                      ))}
                      <span>?</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function ResultLink({ href, icon, onSelect, children }: { href: string; icon: React.ReactNode; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onSelect} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-slate-50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
    </Link>
  );
}
