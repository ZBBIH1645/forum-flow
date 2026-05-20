"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search, UsersRound } from "lucide-react";
import { ForumBadge } from "./forum-badge";
import { ForumLegend } from "./forum-legend";
import { PrivacyNote } from "./privacy-note";
import { useLiveData } from "./live-data-provider";
import { getForumCompositionFromData, getOpenSeats } from "@/lib/matching";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";

export function LiveForums() {
  const { forums, members } = useLiveData();
  const [query, setQuery] = useState("");
  const visibleForums = useMemo(() => forums.filter((forum) =>
    matchesSearch(query, [forum.name, forum.mainLocationZone, forum.forumStyle, forum.groupNotes])
  ), [forums, query]);
  const searchTerms = useMemo(() => getSearchableTerms({ forums }), [forums]);
  const suggestions = useMemo(() => visibleForums.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [query, searchTerms, visibleForums.length]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Forum capacity</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Forum Groups</h1>
          <p className="mt-2 text-sm text-muted">Review confirmed membership, open seats, expectations, and candidate fit for each Forum.</p>
        </div>
      </header>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
            placeholder="Search Forum, location, or style"
            maxLength={inputLimits.search}
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          />
        </label>
      </div>

      <ForumLegend />

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleForums.map((forum) => {
          const openSeats = getOpenSeats(forum);
          const composition = getForumCompositionFromData(forum, members);
          return (
            <Link key={forum.id} href={`/forums/${forum.id}`} className="rounded-lg border border-line bg-white p-5 shadow-card transition hover:border-eo-blue hover:shadow-soft">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <ForumBadge forumId={forum.id} name={forum.name} size="md" />
                  <p className="mt-1 text-sm text-muted">{forum.forumStyle}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${openSeats > 0 ? "bg-eo-teal/10 text-eo-teal" : "bg-slate-100 text-slate-600"}`}>
                  {openSeats} open {openSeats === 1 ? "seat" : "seats"}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Info icon={UsersRound} label="Members" value={`${forum.currentMemberIds.length}/${forum.maxDesiredSize}`} />
                <Info icon={MapPin} label="Main location" value={forum.mainLocationZone} />
                <Info icon={UsersRound} label="Age range" value={composition.ageRange} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SmallMetric label="Revenue range" value={composition.revenueRange} />
                <SmallMetric label="Years in business" value={composition.yearsRange} />
              </div>
              <p className="mt-5 line-clamp-2 text-sm leading-6 text-slate-600">{forum.groupNotes}</p>
            </Link>
          );
        })}
        {visibleForums.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <p className="text-sm font-semibold text-ink">No Forum Groups found</p>
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
            ) : (
              <p className="mt-1 text-sm text-muted">Try another Forum name, location, or style.</p>
            )}
          </div>
        ) : null}
      </div>
      <PrivacyNote />
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-eo-blue" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
