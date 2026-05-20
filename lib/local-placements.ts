import type { MemberStatus } from "./types";

export const localPlacementStorageKey = "forumflow.localPlacements";
export const localPlacementUpdatedEvent = "forumflow.localPlacements.updated";

export type LocalPlacementDecisionStatus =
  | "Shortlisted"
  | "Needs Review"
  | "Rejected"
  | "Approved"
  | "Placed"
  | "Assigned"
  | "Confirmed"
  | "Returned";

export type LocalPlacementDecision = {
  memberId: string;
  memberName: string;
  forumId: string;
  forumName: string;
  status: LocalPlacementDecisionStatus;
  note?: string;
  reason?: string;
  createdAt: string;
};

export function parseLocalPlacementDecisions(value: string | null): LocalPlacementDecision[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as LocalPlacementDecision[] : [];
  } catch {
    return [];
  }
}

export function statusFromLocalDecision(status: LocalPlacementDecision["status"]): MemberStatus {
  if (status === "Confirmed" || status === "Approved" || status === "Placed") return "In Forum";
  if (status === "Assigned") return "Assigned / Pending Forum Review";
  if (status === "Shortlisted") return "Shortlisted";
  if (status === "Needs Review") return "Needs Conflict Review";
  if (status === "Rejected") return "Rejected";
  if (status === "Returned") return "Free Agent";
  return "Free Agent";
}
