"use client";

import { useState } from "react";
import { CheckCircle2, UserCheck, UserX, XCircle } from "lucide-react";
import { useLiveData } from "./live-data-provider";
import type { CompatibilityLabel } from "@/lib/types";

type ActionLabel = "Assigned" | "Shortlisted" | "Confirmed" | "Rejected" | "Reviewed";

export function MatchDecisionButtons({
  memberId,
  forumId,
  label,
  context = "free-agent"
}: {
  memberId: string;
  memberName: string;
  forumId: string;
  forumName: string;
  label: CompatibilityLabel;
  /** Adjusts the actions shown based on whether the member is being assigned or has already been assigned to this forum. */
  context?: "free-agent" | "assigned";
}) {
  const [decision, setDecision] = useState<ActionLabel | null>(null);
  const { getMemberById, getForumById, assignToForum, confirmInForum, rejectAssignment, recordPlacementDecision } = useLiveData();

  const run = (action: ActionLabel) => {
    const member = getMemberById(memberId);
    const forum = getForumById(forumId);
    if (!member || !forum) return;
    if (action === "Assigned") assignToForum({ member, forum });
    else if (action === "Confirmed") confirmInForum({ member, forum });
    else if (action === "Rejected") {
      if (member.assignedForumId === forum.id) rejectAssignment({ member, forum });
      else recordPlacementDecision({ member, forum, status: "Rejected" });
    } else if (action === "Shortlisted") {
      recordPlacementDecision({ member, forum, status: "Shortlisted" });
    } else {
      recordPlacementDecision({ member, forum, status: "Needs Review" });
    }
    setDecision(action);
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {context === "free-agent" ? (
        <>
          <button
            type="button"
            onClick={() => run("Assigned")}
            disabled={label === "Blocked"}
            className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Assign To Forum
          </button>
          <button
            type="button"
            onClick={() => run("Shortlisted")}
            disabled={label === "Blocked"}
            className="inline-flex items-center gap-2 rounded-lg border border-eo-pink/20 bg-eo-pink/10 px-3 py-2 text-sm font-semibold text-eo-pink disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Shortlist
          </button>
          <button
            type="button"
            onClick={() => run("Reviewed")}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => run("Rejected")}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => run("Confirmed")}
            className="inline-flex items-center gap-2 rounded-lg bg-eo-teal px-3 py-2 text-sm font-semibold text-white"
          >
            <UserCheck className="h-4 w-4" />
            Confirm / In Forum
          </button>
          <button
            type="button"
            onClick={() => run("Rejected")}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            <UserX className="h-4 w-4" />
            Reject / Return
          </button>
        </>
      )}
      {decision ? <span className="inline-flex items-center rounded-lg bg-eo-teal/10 px-3 py-2 text-sm font-semibold text-eo-teal">{decision}</span> : null}
    </div>
  );
}
