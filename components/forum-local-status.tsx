"use client";

import { useEffect, useMemo, useState } from "react";
import { localPlacementStorageKey, localPlacementUpdatedEvent, parseLocalPlacementDecisions, type LocalPlacementDecision } from "@/lib/local-placements";
import type { Member } from "@/lib/types";

export function ForumOpenSeatsBadge({
  forumId,
  baseMemberCount,
  maxDesiredSize
}: {
  forumId: string;
  baseMemberCount: number;
  maxDesiredSize: number;
}) {
  const approvedCount = useApprovedLocalPlacements(forumId).length;
  const openSeats = Math.max(0, maxDesiredSize - baseMemberCount - approvedCount);

  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink ring-1 ring-line">
      {openSeats} open {openSeats === 1 ? "seat" : "seats"}
    </span>
  );
}

export function ForumMemberCountMetric({
  forumId,
  baseMemberCount,
  maxDesiredSize
}: {
  forumId: string;
  baseMemberCount: number;
  maxDesiredSize: number;
}) {
  const approvedCount = useApprovedLocalPlacements(forumId).length;
  const count = baseMemberCount + approvedCount;

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Members</p>
      <p className="mt-1 text-sm font-semibold text-ink">{count}/{maxDesiredSize}</p>
      {approvedCount > 0 ? <p className="mt-2 text-xs text-eo-teal">Includes {approvedCount} local approval.</p> : null}
    </div>
  );
}

export function ForumMembersTable({
  forumId,
  currentMembers,
  freeAgents
}: {
  forumId: string;
  currentMembers: Member[];
  freeAgents: Member[];
}) {
  const approvedPlacements = useApprovedLocalPlacements(forumId);
  const freeAgentById = useMemo(() => new Map(freeAgents.map((member) => [member.id, member])), [freeAgents]);
  const locallyPlacedMembers = approvedPlacements
    .map((placement) => freeAgentById.get(placement.memberId))
    .filter((member): member is Member => Boolean(member));
  const memberRows = [...currentMembers, ...locallyPlacedMembers];
  const locallyPlacedIds = new Set(locallyPlacedMembers.map((member) => member.id));

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">Current members</h2>
      <p className="mt-1 text-sm text-muted">{memberRows.length} members shown, including local approved placements.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              {["Name", "Industry", "Revenue", "Years", "Age", "Gender", "Status"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {memberRows.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 text-sm font-semibold text-ink">{member.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.industry}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.revenueRange}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.yearsInBusiness}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.age}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{member.gender}</td>
                <td className="px-4 py-3">
                  {locallyPlacedIds.has(member.id) ? (
                    <span className="rounded-full bg-eo-teal/10 px-2 py-1 text-xs font-semibold text-eo-teal">Locally placed</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">In Forum</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useApprovedLocalPlacements(forumId: string) {
  const [decisions, setDecisions] = useState<LocalPlacementDecision[]>([]);

  useEffect(() => {
    const loadDecisions = () => {
      setDecisions(parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)));
    };

    loadDecisions();
    window.addEventListener(localPlacementUpdatedEvent, loadDecisions);
    window.addEventListener("storage", loadDecisions);
    return () => {
      window.removeEventListener(localPlacementUpdatedEvent, loadDecisions);
      window.removeEventListener("storage", loadDecisions);
    };
  }, []);

  return decisions.filter((decision) => decision.forumId === forumId && (decision.status === "Approved" || decision.status === "Placed"));
}
