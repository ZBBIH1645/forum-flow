"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, ShieldAlert } from "lucide-react";
import { useLiveData } from "./live-data-provider";
import { getMemberRelationships, summarizeConflicts } from "@/lib/member-insights";
import type { Member } from "@/lib/types";

export function ConflictSummaryPanel({ member, compact = false }: { member: Member; compact?: boolean }) {
  const data = useLiveData();
  const relationships = getMemberRelationships(member, data.relationships);
  const summary = summarizeConflicts(member, relationships, data.members, data.forums);
  const unreviewedConflicts = relationships.filter((relationship) => relationship.severity !== "Note Only" && !relationship.reviewed);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  if (summary.count === 0 && compact) return null;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className={`rounded-lg border ${summary.count ? "border-orange-200 bg-orange-50" : "border-line bg-white"} p-4`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            <ShieldAlert className="mr-1 inline h-4 w-4 text-orange-700" />
            Conflict Review
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {summary.count ? `${summary.summary}${unreviewedConflicts.length === 0 ? " · all reviewed" : ""}` : "No conflicts on file."}
          </p>
          <p className="mt-1 text-xs text-muted">
            Recommended action: {summary.count ? "Review relationship details before assignment." : "Add a conflict if one is disclosed."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/members/${member.id}#relationships`} className="text-xs font-semibold text-eo-blue">View Conflict</Link>
          <Link href={`/members/${member.id}#relationships`} className="text-xs font-semibold text-eo-blue">Add Conflict</Link>
        </div>
      </div>

      {summary.count ? (
        <div className="mt-3 space-y-2">
          {relationships.map((relationship) => {
            const relatedId = relationship.memberId === member.id ? relationship.relatedMemberId : relationship.memberId;
            const related = data.getMemberById(relatedId);
            return (
              <div key={relationship.id} className="rounded-lg border border-orange-200 bg-white p-2 text-xs text-slate-700">
                <p className="font-semibold text-ink">
                  <AlertTriangle className="mr-1 inline h-3 w-3 text-orange-700" />
                  {relationship.reviewed ? "Reviewed" : relationship.severity}: {relationship.type}{related ? ` with ${related.name}` : ""}
                </p>
                {relationship.reviewedAt ? <p className="mt-1 text-eo-teal">Conflict reviewed on {new Date(relationship.reviewedAt).toLocaleDateString()}</p> : null}
                {relationship.reviewNote ? <p className="mt-1 text-eo-teal">Review note: {relationship.reviewNote}</p> : null}
                {relationship.notes ? <p className="mt-1">{relationship.notes}</p> : null}
                {related ? <Link href={`/members/${related.id}`} className="mt-1 inline-block font-semibold text-eo-blue">View Related Member</Link> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Conflict review note"
          className="h-9 rounded-lg border border-line bg-white px-3 text-xs text-ink"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              data.markRelationshipReviewed({ member, note });
              showToast("Conflict reviewed");
              setNote("");
            }}
            disabled={unreviewedConflicts.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-eo-teal/30 bg-white px-2 py-1 text-xs font-semibold text-eo-teal disabled:opacity-40"
          >
            <CheckCircle2 className="h-3 w-3" /> {unreviewedConflicts.length === 0 ? "Reviewed" : "Mark Conflict Reviewed"}
          </button>
          <button
            type="button"
            onClick={() => {
              data.updateMemberStatus({ member, status: "Needs Conflict Review", note });
              showToast("Marked Needs Conflict Review");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs font-semibold text-orange-800"
          >
            Mark Needs Conflict Review
          </button>
          <button
            type="button"
            onClick={() => {
              if (!note.trim()) return;
              data.addDecisionNote({ member, note });
              showToast("Note added");
              setNote("");
            }}
            disabled={!note.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink disabled:opacity-40"
          >
            <MessageSquare className="h-3 w-3" /> Add Note
          </button>
        </div>
      </div>
      {toast ? <p className="mt-2 text-xs font-semibold text-eo-teal">{toast}</p> : null}
    </div>
  );
}
