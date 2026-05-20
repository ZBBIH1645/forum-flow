"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckSquare, Download, Plus, Search, Upload, XCircle } from "lucide-react";
import { memberStatuses, useLiveData } from "./live-data-provider";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { ForumBadge } from "./forum-badge";
import { StatusBadge } from "./status-badge";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import type { MemberStatus } from "@/lib/types";

type AssignmentFilter = "All" | "Free Agents" | "In Forums" | "Missing Data" | "Review Flags";

const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");

export function MemberDirectory({
  title = "Members",
  subtitle = "Search and manage the chapter member database.",
  defaultAssignment = "All"
}: {
  title?: string;
  subtitle?: string;
  defaultAssignment?: AssignmentFilter;
}) {
  const { members, relationships, forums, getDataQuality, getEffectiveStatus, getDuplicateCasesForMember, duplicateCases } = useLiveData();
  const data = useLiveData();
  const [query, setQuery] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(defaultAssignment);
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 14;

  const filtered = useMemo(() => {
    return members.filter((member) => {
      const quality = getDataQuality(member);
      const memberRelationships = relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id);
      if (assignmentFilter === "Free Agents" && (member.currentForumId || member.assignedForumId || member.status === "Former Member")) return false;
      if (assignmentFilter === "In Forums" && !member.currentForumId) return false;
      if (assignmentFilter === "Missing Data" && quality[0] === "Complete") return false;
      if (assignmentFilter === "Review Flags" && member.status !== "Needs Conflict Review" && !memberRelationships.some((relationship) => relationship.severity !== "Note Only")) return false;
      if (statusFilter !== "All" && member.status !== statusFilter) return false;
      return matchesSearch(query, [member.name, member.company, member.industry, member.homeLocation, member.businessLocation, member.revenueRange, getEffectiveStatus(member)]);
    });
  }, [assignmentFilter, getDataQuality, getEffectiveStatus, members, query, relationships, statusFilter]);

  const searchTerms = useMemo(() => getSearchableTerms({ members, forums, statuses: memberStatuses }), [forums, members]);
  const suggestions = useMemo(() => filtered.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [filtered.length, query, searchTerms]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageMembers = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedMembers = members.filter((member) => selectedIds.has(member.id));
  const pageSelected = pageMembers.length > 0 && pageMembers.every((member) => selectedIds.has(member.id));
  const assignmentFilters: AssignmentFilter[] = ["All", "Free Agents", "In Forums", "Missing Data", "Review Flags"];

  const showBulkMessage = (message: string) => {
    setBulkMessage(message);
    setTimeout(() => setBulkMessage(null), 3000);
  };

  const toggleSelected = (memberId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const togglePageSelected = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      pageMembers.forEach((member) => {
        if (pageSelected) next.delete(member.id);
        else next.add(member.id);
      });
      return next;
    });
  };

  const runBulkRelationshipReview = () => {
    selectedMembers.forEach((member) => data.markRelationshipReviewed({ member, note: "Bulk action from member directory." }));
    showBulkMessage(`${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} marked reviewed.`);
  };

  const runBulkReadyToAssign = () => {
    if (!window.confirm("Mark selected eligible members Ready To Assign? Members with missing required info or pending relationship review will be skipped.")) return;
    selectedMembers.forEach((member) => data.markReadyToAssign({ member, note: "Bulk action from member directory." }));
    showBulkMessage("Ready-to-assign action applied where eligible.");
  };

  const runBulkOnHold = () => {
    if (!window.confirm("Put selected members On Hold? This changes their status but does not remove relationship notes, assignments, or activity history.")) return;
    selectedMembers.forEach((member) => data.updateMemberStatus({ member, status: "On Hold", note: "Bulk action from member directory." }));
    showBulkMessage(`${selectedMembers.length} member${selectedMembers.length === 1 ? "" : "s"} put on hold.`);
  };

  const exportSelectedCsv = () => {
    const csv = toCsv([
      ["Name", "Company", "Industry", "Status", "Forum", "Home Location", "Business Location", "Revenue Range"],
      ...selectedMembers.map((member) => {
        const forum = forums.find((item) => item.id === (member.currentForumId ?? member.assignedForumId));
        return [member.name, member.company, member.industry, getEffectiveStatus(member), forum?.name ?? "", member.homeLocation, member.businessLocation, member.revenueRange];
      })
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "selected-members.csv";
    link.click();
    URL.revokeObjectURL(url);
    showBulkMessage(`${selectedMembers.length} selected member${selectedMembers.length === 1 ? "" : "s"} exported.`);
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Member database</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {duplicateCases.some((duplicate) => duplicate.status === "Unresolved" || duplicate.status === "Skipped") ? (
            <Link href="/duplicate-review" className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-card">
              <AlertTriangle className="h-4 w-4" />
              Review possible duplicates
            </Link>
          ) : null}
          <Link href="/members/import" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-card">
            <Upload className="h-4 w-4" />
            CSV import
          </Link>
          <Link href="/members/new" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-card">
            <Plus className="h-4 w-4" />
            Add member
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">{filtered.length} members</h2>
            <p className="mt-1 text-sm text-muted">Filtered from {members.length} current records.</p>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              {assignmentFilters.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => {
                    setAssignmentFilter(filter);
                    setPage(1);
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    assignmentFilter === filter ? "border-eo-purple bg-eo-purple text-white" : "border-line bg-white text-slate-700 hover:border-eo-blue"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as MemberStatus | "All");
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
              >
                <option value="All">All statuses</option>
                {memberStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(sanitizeSingleLine(event.target.value, inputLimits.search));
                    setPage(1);
                  }}
                  placeholder="Search members"
                  maxLength={inputLimits.search}
                  className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10 sm:w-72"
                />
              </label>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-col gap-3 border-b border-line bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-ink">{selectedIds.size} selected</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runBulkRelationshipReview} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-blue">
                <CheckSquare className="h-4 w-4" /> Mark relationship reviewed
              </button>
              <button type="button" onClick={runBulkReadyToAssign} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-blue">
                <CheckSquare className="h-4 w-4" /> Mark Ready To Assign
              </button>
              <button type="button" onClick={runBulkOnHold} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-blue">
                <XCircle className="h-4 w-4" /> Put on hold
              </button>
              <button type="button" onClick={exportSelectedCsv} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-blue">
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-ink">
                Clear
              </button>
            </div>
            {bulkMessage ? <p className="text-xs font-semibold text-eo-teal">{bulkMessage}</p> : null}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select page members"
                    checked={pageSelected}
                    onChange={togglePageSelected}
                    className="h-4 w-4 rounded border-line text-eo-purple"
                  />
                </th>
                {["Name", "Company", "Industry", "Forum", "Status", "Data", "Conflicts", "Action"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {pageMembers.map((member) => {
                const quality = getDataQuality(member);
                const duplicates = getDuplicateCasesForMember(member.id);
                const conflictCount = relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id).length;
                const forum = member.currentForumId
                  ? forums.find((f) => f.id === member.currentForumId)
                  : member.assignedForumId
                  ? forums.find((f) => f.id === member.assignedForumId)
                  : undefined;
                return (
                  <tr key={member.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.name}`}
                        checked={selectedIds.has(member.id)}
                        onChange={() => toggleSelected(member.id)}
                        className="h-4 w-4 rounded border-line text-eo-purple"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
                      {duplicates.length > 0 ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Possible Duplicate
                        </span>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">{member.age} · {member.gender}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{member.company}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{member.industry}</td>
                    <td className="px-4 py-4">
                      {forum ? (
                        <ForumBadge forumId={forum.id} name={forum.name} suffix={member.assignedForumId ? "(pending)" : undefined} href={`/forums/${forum.id}`} />
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-4"><StatusBadge status={getEffectiveStatus(member)} /></td>
                    <td className="px-4 py-4 text-sm text-slate-700">{quality[0]}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{conflictCount}</td>
                    <td className="px-4 py-4">
                      <Link href={`/members/${member.id}`} className="whitespace-nowrap text-sm font-semibold text-eo-blue hover:text-eo-purple">Open profile</Link>
                    </td>
                  </tr>
                );
              })}
              {pageMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-ink">No members found</p>
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
                      <p className="mt-1 text-sm text-muted">Adjust the filters or search terms to broaden the list.</p>
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
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} className="rounded-lg border border-line px-3 py-2 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="rounded-lg border border-line px-3 py-2 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
