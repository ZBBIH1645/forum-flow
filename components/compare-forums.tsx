"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, UserMinus, UserPlus, X, XCircle } from "lucide-react";
import { CompatibilityBadge } from "./compatibility-badge";
import { ForumBadge } from "./forum-badge";
import { useLiveData, decisionReasons } from "./live-data-provider";
import { reviewCompatibilityWithData, getOpenSeats } from "@/lib/matching";
import { compareMemberToForum, fitToneClass } from "@/lib/comparison";
import type { DecisionReason, ForumGroup, Member } from "@/lib/types";

const FIELD_ORDER = [
  "Compatibility label",
  "Open seats",
  "Location fit",
  "Revenue fit",
  "Years-in-business fit",
  "Industry overlap",
  "Relationship status",
  "Group expectations",
  "Group notes",
  "Missing info",
  "Concerns"
];

export function CompareForums({
  member,
  forumIds,
  onClose
}: {
  member: Member;
  forumIds: string[];
  onClose: () => void;
}) {
  const data = useLiveData();
  const { members, relationships, getForumById, getDataQuality, logComparison } = data;

  const forums = useMemo(
    () => forumIds.map((id) => getForumById(id)).filter((forum): forum is ForumGroup => Boolean(forum)),
    [forumIds, getForumById]
  );

  useEffect(() => {
    if (forums.length > 0) logComparison({ member, forums });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberQuality = getDataQuality(member).filter((label) => label !== "Complete");

  const columns = useMemo(() => forums.map((forum) => {
    const review = reviewCompatibilityWithData(member, forum, members, relationships);
    const fit = compareMemberToForum(member, forum, members, relationships);
    return { forum, review, fit, openSeats: getOpenSeats(forum) };
  }), [forums, member, members, relationships]);

  if (forums.length === 0) return null;

  return (
    <div className="rounded-lg border border-eo-purple/30 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-line bg-eo-purple/5 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-eo-purple">Side-by-side comparison</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">Top Forum options for {member.name}</h3>
        </div>
        <button type="button" aria-label="Close Forum comparison" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-slate-600 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">Field</th>
              {columns.map(({ forum, openSeats }) => (
                <th key={forum.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <ForumBadge forumId={forum.id} name={forum.name} href={`/forums/${forum.id}`} />
                  <p className="mt-1 text-xs text-muted normal-case tracking-normal">{forum.mainLocationZone} · {forum.forumStyle}</p>
                  <p className="text-xs text-muted normal-case tracking-normal">{openSeats} open {openSeats === 1 ? "seat" : "seats"}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {FIELD_ORDER.map((field) => (
              <tr key={field}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">{field}</td>
                {columns.map(({ forum, review, fit, openSeats }) => {
                  if (field === "Compatibility label") {
                    return <td key={forum.id} className="px-4 py-3"><CompatibilityBadge label={review.label} /></td>;
                  }
                  if (field === "Open seats") {
                    return <td key={forum.id} className="px-4 py-3 text-sm text-slate-700">{openSeats > 0 ? `${openSeats} open` : "Full"}</td>;
                  }
                  if (field === "Group expectations") {
                    return <td key={forum.id} className="px-4 py-3 text-sm text-slate-700">{forum.specialExpectations}</td>;
                  }
                  if (field === "Group notes") {
                    return <td key={forum.id} className="px-4 py-3 text-sm text-slate-600">{forum.groupNotes}</td>;
                  }
                  if (field === "Missing info") {
                    if (memberQuality.length === 0) {
                      return <td key={forum.id} className="px-4 py-3"><span className="rounded-full bg-eo-teal/10 px-2 py-0.5 text-xs font-semibold text-eo-teal">Complete</span></td>;
                    }
                    return <td key={forum.id} className="px-4 py-3 text-sm text-amber-800">{memberQuality.join(", ")}</td>;
                  }
                  if (field === "Concerns") {
                    const concerns = [...review.hardBlockers, ...review.softWarnings].slice(0, 2);
                    if (concerns.length === 0) return <td key={forum.id} className="px-4 py-3 text-sm text-slate-500">No concerns flagged.</td>;
                    return <td key={forum.id} className="px-4 py-3 text-sm text-slate-700">{concerns.join(" ")}</td>;
                  }
                  const fitField = fit.find((f) => f.label === field);
                  if (fitField) {
                    return (
                      <td key={forum.id} className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${fitToneClass(fitField.tone)}`}>{fitField.value}</span>
                      </td>
                    );
                  }
                  return <td key={forum.id} className="px-4 py-3" />;
                })}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Actions</td>
              {columns.map(({ forum, review }) => (
                <td key={forum.id} className="px-4 py-3">
                  <ForumActionCluster member={member} forum={forum} blocked={review.label === "Blocked"} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ForumActionCluster({ member, forum, blocked }: { member: Member; forum: ForumGroup; blocked: boolean }) {
  const data = useLiveData();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);

  const isShortlisted = data.isCurrentlyShortlistedForPair(member.id, forum.id);
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
        <button
          type="button"
          onClick={() => {
            data.rejectPairing({ member, forum, note, reason: reasonValue });
            showToast("Pairing rejected");
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
        >
          <XCircle className="h-3 w-3" /> Reject pairing
        </button>
      </div>
      {toast ? <p className="text-xs font-semibold text-eo-teal">{toast}</p> : null}
    </div>
  );
}
