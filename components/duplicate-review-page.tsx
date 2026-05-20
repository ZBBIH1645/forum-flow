"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, CheckCircle2, GitMerge, Search, XCircle } from "lucide-react";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { useLiveData } from "./live-data-provider";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import type { DuplicateCase, Member } from "@/lib/types";

const openStatuses = new Set<DuplicateCase["status"]>(["Unresolved", "Skipped"]);

export function DuplicateReviewPage() {
  const data = useLiveData();
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  const cases = useMemo(() => data.duplicateCases.filter((duplicate) => showClosed || openStatuses.has(duplicate.status)), [data.duplicateCases, showClosed]);
  const filtered = useMemo(() => cases.filter((duplicate) => {
    const memberA = data.getMemberById(duplicate.memberAId);
    const memberB = duplicate.memberBId ? data.getMemberById(duplicate.memberBId) : duplicate.draftMember;
    return matchesSearch(query, [
      duplicate.status,
      duplicate.confidence,
      duplicate.source,
      duplicate.rowName,
      memberA?.name,
      memberA?.company,
      memberB?.name,
      memberB?.company,
      ...duplicate.reasons
    ]);
  }), [cases, data, query]);
  const searchTerms = useMemo(() => getSearchableTerms({ members: data.members }), [data.members]);
  const suggestions = useMemo(() => filtered.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [filtered.length, query, searchTerms]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Data cleanup</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Duplicate Review</h1>
          <p className="mt-2 text-sm text-muted">Resolve possible duplicate records before assignment decisions. Merge only after choosing the survivor record.</p>
        </div>
        <Link href="/data-quality" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">Open Data Quality</Link>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
            placeholder="Search duplicate cases"
            maxLength={inputLimits.search}
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} className="h-4 w-4 rounded border-line text-eo-purple" />
          Show resolved cases
        </label>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 className="text-base font-semibold text-ink">{filtered.length} duplicate case{filtered.length === 1 ? "" : "s"}</h2>
            <p className="mt-1 text-sm text-muted">Open cases block confident placement until reviewed.</p>
          </div>
          <GitMerge className="h-5 w-5 text-eo-purple" />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-eo-teal" />
            <p className="mt-3 text-sm font-medium text-slate-600">No duplicate cases found.</p>
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
        ) : (
          <div className="divide-y divide-line">
            {filtered.map((duplicate) => (
              <DuplicateCaseRow key={duplicate.id} duplicate={duplicate} data={data} />
            ))}
          </div>
        )}
      </div>

      <PrivacyNote />
    </div>
  );
}

function DuplicateCaseRow({ duplicate, data }: { duplicate: DuplicateCase; data: ReturnType<typeof useLiveData> }) {
  const memberA = data.getMemberById(duplicate.memberAId);
  const memberB = duplicate.memberBId ? data.getMemberById(duplicate.memberBId) : duplicate.draftMember;
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canMerge = Boolean(memberA && memberB && duplicate.memberBId && openStatuses.has(duplicate.status));

  const showMessage = (next: string) => {
    setMessage(next);
    setTimeout(() => setMessage(null), 3500);
  };

  const mergeInto = (survivor: Member) => {
    if (!note.trim()) {
      showMessage("Add a decision note before merging.");
      return;
    }
    if (!window.confirm(`Merge the other duplicate record into ${survivor.name}? The merged-away record will be archived and excluded from active counts.`)) return;
    const result = data.mergeDuplicateCase({ caseId: duplicate.id, primaryId: survivor.id, finalMember: survivor, note });
    showMessage(result.message);
  };

  return (
    <div className="p-5">
      {message ? <div className="mb-3 rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-3 text-sm font-semibold text-eo-teal">{message}</div> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <DuplicateMemberCard label="Record A" member={memberA} />
        <DuplicateMemberCard label={duplicate.memberBId ? "Record B" : "Imported draft"} member={memberB} />
        <div className="rounded-lg border border-line bg-slate-50 p-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{duplicate.confidence}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-line">{duplicate.status}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-line">{duplicate.source}</span>
          </div>
          <p className="mt-3 text-sm text-slate-700">{duplicate.reasons.join(", ") || "Possible duplicate match."}</p>
          {duplicate.rowNumber ? <p className="mt-1 text-xs text-muted">Import row {duplicate.rowNumber}</p> : null}

          {openStatuses.has(duplicate.status) ? (
            <div className="mt-4 space-y-3">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Decision note for merge, skip, or not duplicate"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              />
              <div className="flex flex-wrap gap-2">
                {canMerge && memberA ? (
                  <button type="button" onClick={() => mergeInto(memberA)} className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-3 py-2 text-xs font-semibold text-white">
                    <GitMerge className="h-3.5 w-3.5" /> Merge into A
                  </button>
                ) : null}
                {canMerge && memberB ? (
                  <button type="button" onClick={() => mergeInto(memberB)} className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-3 py-2 text-xs font-semibold text-white">
                    <GitMerge className="h-3.5 w-3.5" /> Merge into B
                  </button>
                ) : null}
                <button type="button" onClick={() => { data.markDuplicateNotDuplicate(duplicate.id, note); showMessage("Marked not duplicate."); }} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
                  <XCircle className="h-3.5 w-3.5" /> Not duplicate
                </button>
                <button type="button" onClick={() => { data.skipDuplicateCase(duplicate.id, note); showMessage("Skipped for later review."); }} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
                  <AlertTriangle className="h-3.5 w-3.5" /> Skip for later
                </button>
                <button type="button" onClick={() => { if (window.confirm("Archive this duplicate review case? This does not delete member records.")) data.archiveDuplicateCase(duplicate.id, note); }} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
                  <Archive className="h-3.5 w-3.5" /> Archive case
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DuplicateMemberCard({ label, member }: { label: string; member?: Member }) {
  const isDraft = member?.id.startsWith("mem-import-draft");
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {member ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isDraft ? (
              <span className="text-sm font-semibold text-ink">{member.name}</span>
            ) : (
              <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
            )}
            <StatusBadge status={member.status} />
          </div>
          <p className="mt-1 text-sm text-slate-700">{member.company || "No company"} · {member.industry || "No industry"}</p>
          <p className="mt-1 text-xs text-muted">{member.homeLocation || "No home location"} · {member.businessLocation || "No business location"}</p>
          <p className="mt-1 text-xs text-muted">{member.currentForumId ? "Confirmed In Forum" : member.assignedForumId ? "Assigned / Pending Forum Review" : "No active Forum"}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Record no longer available.</p>
      )}
    </div>
  );
}
