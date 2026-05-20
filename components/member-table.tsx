"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { localPlacementStorageKey, localPlacementUpdatedEvent, parseLocalPlacementDecisions, statusFromLocalDecision, type LocalPlacementDecision } from "@/lib/local-placements";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import { StatusBadge } from "./status-badge";
import type { Member, MemberStatus } from "@/lib/types";

type StatusFilter = "All" | "Free Agent" | "Needs Conflict Review" | "In Forum";
const filters: StatusFilter[] = ["All", "Free Agent", "Needs Conflict Review", "In Forum"];

export function MemberTable({ members, title = "Free agents" }: { members: Member[]; title?: string }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);
  const [localDecisions, setLocalDecisions] = useState<LocalPlacementDecision[]>([]);
  const pageSize = 12;

  useEffect(() => {
    const loadLocalDecisions = () => {
      setLocalDecisions(parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)));
    };

    loadLocalDecisions();
    window.addEventListener(localPlacementUpdatedEvent, loadLocalDecisions);
    window.addEventListener("storage", loadLocalDecisions);
    return () => {
      window.removeEventListener(localPlacementUpdatedEvent, loadLocalDecisions);
      window.removeEventListener("storage", loadLocalDecisions);
    };
  }, []);

  const localDecisionByMember = useMemo(() => new Map(localDecisions.map((decision) => [decision.memberId, decision])), [localDecisions]);

  const effectiveStatus = useCallback((member: Member): MemberStatus => {
    const localDecision = localDecisionByMember.get(member.id);
    return localDecision ? statusFromLocalDecision(localDecision.status) : member.status;
  }, [localDecisionByMember]);

  const filtered = useMemo(() => {
    return members.filter((member) => {
      const status = effectiveStatus(member);
      if (statusFilter !== "All" && status !== statusFilter) return false;
      return matchesSearch(query, [member.name, member.company, member.industry, member.homeLocation, member.businessLocation, member.revenueRange, status]);
    });
  }, [members, query, statusFilter, effectiveStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageMembers = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const searchTerms = useMemo(() => getSearchableTerms({ members, statuses: filters }), [members]);
  const suggestions = useMemo(() => filtered.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [filtered.length, query, searchTerms]);

  return (
    <div className="rounded-lg border border-line bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{filtered.length} members match the current view</p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  statusFilter === filter ? "border-eo-purple bg-eo-purple text-white" : "border-line bg-white text-slate-700 hover:border-eo-blue"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(sanitizeSingleLine(event.target.value, inputLimits.search));
                setPage(1);
              }}
              placeholder="Search free agents"
              maxLength={inputLimits.search}
              className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10 sm:w-72"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              {["Name", "Company", "Industry", "Home", "Revenue", "Years in business", "Age", "Gender", "Status", "Action"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {pageMembers.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-4">
                  <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">
                    {member.name}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.company}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.industry}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.homeLocation}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.revenueRange}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.yearsInBusiness}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.age}</td>
                <td className="px-4 py-4 text-sm text-slate-700">{member.gender}</td>
                <td className="px-4 py-4"><StatusBadge status={effectiveStatus(member)} /></td>
                <td className="px-4 py-4">
                  <Link href={`/members/${member.id}`} className="whitespace-nowrap text-sm font-semibold text-eo-blue hover:text-eo-purple">
                    Review matches
                  </Link>
                </td>
              </tr>
            ))}
            {pageMembers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-ink">No free agents found</p>
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
                    <p className="mt-1 text-sm text-muted">Try another search or status filter.</p>
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-line p-4 text-sm text-muted">
        <span>Page {safePage} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={safePage === 1}
            className="rounded-lg border border-line px-3 py-2 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg border border-line px-3 py-2 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
