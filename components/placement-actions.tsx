"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Hourglass, UserCheck, UserX, XCircle } from "lucide-react";
import { decisionReasons, useLiveData } from "./live-data-provider";
import { CompatibilityBadge } from "./compatibility-badge";
import { ConflictSummaryPanel } from "./conflict-summary-panel";
import { calculateAge, getAssignmentDaysLeft } from "@/lib/assignments";
import type { CompatibilityLabel, DecisionReason } from "@/lib/types";

type PlacementOption = {
  forumId: string;
  forumName: string;
  label: CompatibilityLabel;
  hardBlockerCount: number;
  warningCount: number;
};

export function PlacementActions({
  memberId,
  memberName,
  options
}: {
  memberId: string;
  memberName: string;
  options: PlacementOption[];
}) {
  const { getMemberById, getForumById, assignToForum, confirmInForum, rejectAssignment, returnToFreeAgent, recordPlacementDecision, updateMemberStatus, getEffectiveStatus, getMissingRequiredFields } = useLiveData();
  const member = getMemberById(memberId);

  const effectiveStatus = member ? getEffectiveStatus(member) : undefined;
  const assignedForum = member?.assignedForumId ? getForumById(member.assignedForumId) : undefined;
  const isAssigned = Boolean(assignedForum) && (member?.status === "Assigned / Pending Forum Review" || effectiveStatus === "Assignment Expired");

  const firstAvailable = options.find((option) => option.label !== "Blocked") ?? options[0];
  const [selectedForumId, setSelectedForumId] = useState(firstAvailable?.forumId ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const selectedOption = useMemo(() => options.find((option) => option.forumId === selectedForumId) ?? firstAvailable, [firstAvailable, options, selectedForumId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  if (!member) return null;

  const reasonValue = reason ? reason : undefined;
  const missingRequired = getMissingRequiredFields(member);

  const handleAssign = () => {
    if (missingRequired.length > 0 && !note.trim()) {
      showToast("This member is missing required info. Add a decision note to override.");
      return;
    }
    if (!selectedOption) return;
    const forum = getForumById(selectedOption.forumId);
    if (!forum) return;
    assignToForum({ member, forum, note, reason: reasonValue });
    showToast(`${memberName} assigned to ${forum.name}. 90-day Forum review window started.`);
    setNote("");
  };

  const handleShortlist = () => {
    if (missingRequired.length > 0 && !note.trim()) {
      showToast("This member is missing required info. Add a decision note to override.");
      return;
    }
    if (!selectedOption) return;
    const forum = getForumById(selectedOption.forumId);
    if (!forum) return;
    recordPlacementDecision({ member, forum, status: "Shortlisted", note });
    showToast(`${memberName} shortlisted for ${forum.name}.`);
  };

  const handleMarkNeedsReview = () => {
    updateMemberStatus({ member, status: "Needs Conflict Review", note });
    showToast(`${memberName} flagged for conflict review.`);
  };

  const handleConfirm = () => {
    if (!assignedForum) return;
    confirmInForum({ member, forum: assignedForum, note, reason: reasonValue });
    showToast(`${memberName} confirmed in ${assignedForum.name}.`);
  };

  const handleReject = () => {
    if (!assignedForum) return;
    rejectAssignment({ member, forum: assignedForum, note, reason: reasonValue });
    showToast(`${memberName} returned to Free Agents from ${assignedForum.name}.`);
  };

  const handleReturnToFreeAgent = () => {
    returnToFreeAgent({ member, note, reason: reasonValue });
    showToast(`${memberName} returned to Free Agents.`);
  };

  const daysLeft = getAssignmentDaysLeft(member);

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eo-purple">Placement actions</p>
          <h2 className="mt-1 text-base font-semibold text-ink">{isAssigned ? "Forum review pending" : "Assign to a Forum"}</h2>
          <p className="mt-1 text-sm text-muted">
            {isAssigned
              ? `${memberName} is assigned to ${assignedForum?.name ?? "a Forum"} and waiting on the Forum's decision.`
              : "Pick a Forum, then assign the member for Forum review (90-day window) or mark another action."}
          </p>
        </div>
        {isAssigned && daysLeft !== null ? (
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${daysLeft < 0 ? "bg-rose-100 text-rose-800" : daysLeft <= 14 ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"}`}>
            <Hourglass className="mr-1 inline h-4 w-4" />
            {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days left in Forum review`}
          </div>
        ) : null}
      </div>

      {!isAssigned ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Forum</span>
            <select
              value={selectedForumId}
              onChange={(event) => setSelectedForumId(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
            >
              {options.map((option) => (
                <option key={option.forumId} value={option.forumId}>
                  {option.forumName} - {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reason (optional)</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as DecisionReason | "")}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
            >
              <option value="">No preset reason</option>
              {decisionReasons.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
            </select>
          </label>
          {selectedOption ? (
            <div className="md:col-span-2 rounded-lg border border-line bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold text-ink">{selectedOption.label}</span>
              <span className="ml-2"><CompatibilityBadge label={selectedOption.label} /></span>
              {" · "}{selectedOption.hardBlockerCount} hard blockers{" · "}{selectedOption.warningCount} warnings
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reason (optional)</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as DecisionReason | "")}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
            >
              <option value="">No preset reason</option>
              {decisionReasons.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
            </select>
          </label>
          <div className="rounded-lg border border-line bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-ink">Status: {effectiveStatus}</p>
            <p className="mt-1 text-xs text-muted">Forum: {assignedForum?.name ?? "—"}</p>
            <p className="mt-1 text-xs text-muted">Start: {member.assignmentStartDate ? new Date(member.assignmentStartDate).toLocaleDateString() : "—"} · Expires: {member.assignmentExpiresAt ? new Date(member.assignmentExpiresAt).toLocaleDateString() : "—"}</p>
            <p className="mt-1 text-xs text-muted">Assigned means the member is under Forum review. They are not counted as In Forum until the Forum confirms.</p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <ConflictSummaryPanel member={member} compact />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Decision note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          placeholder="Optional context, follow-up note, or rationale"
        />
      </label>

      {toast ? (
        <div className="mt-4 rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-3 text-sm font-medium text-eo-teal">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          {toast}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {!isAssigned ? (
          <>
            <button
              onClick={handleAssign}
              disabled={selectedOption?.label === "Blocked"}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CheckCircle2 className="h-4 w-4" />
              Assign To Forum
            </button>
            <button
              onClick={handleShortlist}
              disabled={selectedOption?.label === "Blocked"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-eo-pink/20 bg-eo-pink/10 px-4 py-2.5 text-sm font-semibold text-eo-pink disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              Shortlist
            </button>
            <button
              onClick={handleMarkNeedsReview}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900"
            >
              <AlertTriangle className="h-4 w-4" />
              Mark Needs Review
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-eo-teal px-4 py-2.5 text-sm font-semibold text-white"
            >
              <UserCheck className="h-4 w-4" />
              Confirm / Mark In Forum
            </button>
            <button
              onClick={handleReject}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700"
            >
              <UserX className="h-4 w-4" />
              Reject / Return To Free Agent
            </button>
            <button
              onClick={handleReturnToFreeAgent}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
            >
              <XCircle className="h-4 w-4" />
              Cancel Assignment
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MemberAge({ memberId }: { memberId: string }) {
  const { getMemberById } = useLiveData();
  const member = getMemberById(memberId);
  if (!member) return null;
  return <span>{calculateAge(member)}</span>;
}
