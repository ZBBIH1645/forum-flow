"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, UserCheck, UserMinus, UserPlus, X, XCircle } from "lucide-react";
import { CompatibilityBadge } from "./compatibility-badge";
import { useLiveData, decisionReasons } from "./live-data-provider";
import { reviewCompatibilityWithData } from "@/lib/matching";
import { compareMemberToForum, fitToneClass } from "@/lib/comparison";
import { calculateAge } from "@/lib/assignments";
import type { DecisionReason, ForumGroup, Member } from "@/lib/types";

const FIELD_ORDER = [
  "Compatibility label",
  "Status",
  "Location fit",
  "Revenue fit",
  "Years-in-business fit",
  "Age / life-stage fit",
  "Industry overlap",
  "Relationship status",
  "Missing info",
  "Key concerns",
  "Notes"
];

export function CompareCandidates({
  forum,
  candidateIds,
  onClose
}: {
  forum: ForumGroup;
  candidateIds: string[];
  onClose: () => void;
}) {
  const data = useLiveData();
  const { members, relationships, getMemberById, getDataQuality, getEffectiveStatus, logComparison } = data;

  const candidates = useMemo(
    () => candidateIds.map((id) => getMemberById(id)).filter((member): member is Member => Boolean(member)),
    [candidateIds, getMemberById]
  );

  useEffect(() => {
    if (candidates.length > 0) {
      logComparison({ forum, members: candidates });
    }
    // Run once on mount per forum + candidate set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => candidates.map((member) => {
    const review = reviewCompatibilityWithData(member, forum, members, relationships);
    const fit = compareMemberToForum(member, forum, members, relationships);
    const quality = getDataQuality(member).filter((label) => label !== "Complete");
    return { member, review, fit, quality };
  }), [candidates, forum, getDataQuality, members, relationships]);

  if (candidates.length === 0) return null;

  return (
    <div className="rounded-lg border border-eo-purple/30 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-eo-purple/5 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-eo-purple">Side-by-side comparison</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">Top candidates for {forum.name}</h3>
        </div>
        <button type="button" aria-label="Close candidate comparison" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-slate-600 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Field</th>
              {rows.map(({ member }) => (
                <th key={member.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
                  <p className="mt-1 text-xs text-muted normal-case tracking-normal">{member.company}</p>
                  <p className="text-xs text-muted normal-case tracking-normal">{member.industry}</p>
                  <p className="text-xs text-muted normal-case tracking-normal">{calculateAge(member)} yrs · {member.gender}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {FIELD_ORDER.map((field) => (
              <tr key={field}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{field}</td>
                {rows.map(({ member, review, fit, quality }) => {
                  if (field === "Compatibility label") {
                    return <td key={member.id} className="px-4 py-3"><CompatibilityBadge label={review.label} /></td>;
                  }
                  if (field === "Status") {
                    return <td key={member.id} className="px-4 py-3 text-sm text-slate-700">{getEffectiveStatus(member)}</td>;
                  }
                  if (field === "Missing info") {
                    if (quality.length === 0) {
                      return <td key={member.id} className="px-4 py-3"><span className="rounded-full bg-eo-teal/10 px-2 py-0.5 text-xs font-semibold text-eo-teal">Complete</span></td>;
                    }
                    return <td key={member.id} className="px-4 py-3 text-sm text-amber-800">{quality.join(", ")}</td>;
                  }
                  if (field === "Key concerns") {
                    const concerns = [...review.hardBlockers, ...review.softWarnings].slice(0, 2);
                    if (concerns.length === 0) return <td key={member.id} className="px-4 py-3 text-sm text-slate-500">No concerns flagged.</td>;
                    return <td key={member.id} className="px-4 py-3 text-sm text-slate-700">{concerns.join(" ")}</td>;
                  }
                  if (field === "Notes") {
                    return <td key={member.id} className="px-4 py-3 text-sm text-slate-600">{member.notes || "No notes."}</td>;
                  }
                  const fitField = fit.find((f) => f.label === field);
                  if (fitField) {
                    return (
                      <td key={member.id} className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${fitToneClass(fitField.tone)}`}>{fitField.value}</span>
                      </td>
                    );
                  }
                  return <td key={member.id} className="px-4 py-3" />;
                })}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Actions</td>
              {rows.map(({ member, review }) => (
                <td key={member.id} className="px-4 py-3">
                  <CandidateActionCluster forum={forum} member={member} blocked={review.label === "Blocked"} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidateActionCluster({ forum, member, blocked }: { forum: ForumGroup; member: Member; blocked: boolean }) {
  const data = useLiveData();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);

  const isShortlisted = data.isCurrentlyShortlistedForPair(member.id, forum.id);
  const isAssignedHere = member.assignedForumId === forum.id;
  const reasonValue = reason ? reason : undefined;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-1">
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as DecisionReason | "")}
          className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        >
          <option value="">Reason (optional)</option>
          {decisionReasons.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
        </select>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Decision note"
          className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!isShortlisted ? (
          <button
            type="button"
            onClick={() => {
              data.addToShortlist({ member, forum, note, reason: reasonValue });
              showToast("Shortlisted");
            }}
            disabled={blocked}
            className="inline-flex items-center gap-1 rounded-lg border border-eo-pink/20 bg-eo-pink/10 px-2 py-1 text-xs font-semibold text-eo-pink disabled:opacity-40"
          >
            <UserPlus className="h-3 w-3" /> Shortlist
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              data.removeFromShortlist({ member, forum, note });
              showToast("Removed");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700"
          >
            <UserMinus className="h-3 w-3" /> Remove
          </button>
        )}
        {!isAssignedHere ? (
          <button
            type="button"
            onClick={() => {
              data.assignToForum({ member, forum, note, reason: reasonValue });
              showToast("Assigned");
            }}
            disabled={blocked}
            className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-2 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
          >
            <CheckCircle2 className="h-3 w-3" /> Assign
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              data.confirmInForum({ member, forum, note, reason: reasonValue });
              showToast("Confirmed");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-eo-teal px-2 py-1 text-xs font-semibold text-white"
          >
            <UserCheck className="h-3 w-3" /> Confirm
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            data.updateMemberStatus({ member, status: "Needs Conflict Review", note });
            showToast("Marked Needs Review");
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
        >
          Needs Review
        </button>
        <button
          type="button"
          onClick={() => {
            data.rejectPairing({ member, forum, note, reason: reasonValue });
            showToast("Pairing rejected");
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
        >
          <XCircle className="h-3 w-3" /> Reject
        </button>
      </div>
      {toast ? <p className="text-xs font-semibold text-eo-teal">{toast}</p> : null}
    </div>
  );
}
