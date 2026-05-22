import { getAssignmentDaysLeft } from "./assignments";
import { REQUIRED_FIELD_DETAILS, missingRequiredFields } from "./data-quality";
import type { DataQualityLabel, ForumGroup, Member, MemberRelationship } from "./types";

export type MemberFlag = {
  label: string;
  reason: string;
  severity: "Blocked" | "Needs Review" | "Warning" | "Info";
  recommendedAction: string;
};

const severityRank = { Blocked: 3, "Needs Review": 2, Warning: 1, Info: 0 } satisfies Record<MemberFlag["severity"], number>;

export const summarizeMissingFields = (labels: DataQualityLabel[]) => {
  const missing = missingRequiredFields(labels);
  if (missing.length === 0) return "Required info complete";
  return `Needs Info: ${missing.map((label) => REQUIRED_FIELD_DETAILS[label].displayName).join(", ")}`;
};

export const buildMemberFlags = (member: Member, labels: DataQualityLabel[]): MemberFlag[] => {
  const flags: MemberFlag[] = missingRequiredFields(labels).map((label) => ({
    label: REQUIRED_FIELD_DETAILS[label].displayName,
    reason: REQUIRED_FIELD_DETAILS[label].why,
    severity: "Warning",
    recommendedAction: label === "Missing Relationship Review" ? "Complete relationship review." : "Add missing info."
  }));
  if (labels.includes("Has Hard Conflicts")) {
    flags.push({ label: "Has Hard Conflict", reason: "At least one blocked relationship is on file.", severity: "Blocked", recommendedAction: "Review conflicts before assignment." });
  }
  if (labels.includes("Possible Duplicate")) {
    flags.push({ label: "Possible Duplicate", reason: "An unresolved duplicate review case exists.", severity: "Warning", recommendedAction: "Open Duplicate Review before placement." });
  }
  if (labels.includes("Stale Record")) {
    flags.push({ label: "Stale Record", reason: "Profile has not been updated in 180+ days.", severity: "Warning", recommendedAction: "Refresh member data." });
  }
  if (member.status === "Assigned / Pending Forum Review") {
    flags.push({ label: "Assigned / Pending Forum Review", reason: "Member is assigned but not confirmed In Forum.", severity: "Info", recommendedAction: "Wait for Forum confirmation or rejection." });
  }
  if (member.status === "Assignment Expired") {
    flags.push({ label: "Assignment Expired", reason: "The 90-day assignment window has passed.", severity: "Warning", recommendedAction: "Return to Free Agent or reassign." });
  }
  const daysLeft = getAssignmentDaysLeft(member);
  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) {
    flags.push({ label: "Assignment Expiring Soon", reason: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in Forum review.`, severity: "Warning", recommendedAction: "Follow up with the Forum." });
  }
  return flags.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
};

export const getMemberRelationships = (member: Member, relationships: MemberRelationship[]) =>
  relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id);

export const summarizeConflicts = (member: Member, relationships: MemberRelationship[], members: Member[], forums: ForumGroup[]) => {
  const related = getMemberRelationships(member, relationships);
  if (related.length === 0) return { count: 0, summary: "No conflicts on file", highestSeverity: "None", details: [] as string[] };
  const memberById = new Map(members.map((item) => [item.id, item]));
  const forumById = new Map(forums.map((forum) => [forum.id, forum]));
  const rank = { Blocked: 3, "Needs Review": 2, "Note Only": 1 };
  const sorted = [...related].sort((a, b) => rank[b.severity] - rank[a.severity]);
  const highest = sorted[0].severity;
  const counts = sorted.reduce<Record<string, number>>((acc, relationship) => {
    const key = relationship.reviewed ? `Reviewed ${relationship.severity}` : relationship.severity;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const details = sorted.map((relationship) => {
    const relatedId = relationship.memberId === member.id ? relationship.relatedMemberId : relationship.memberId;
    const relatedMember = memberById.get(relatedId);
    const forum = relatedMember?.currentForumId ? forumById.get(relatedMember.currentForumId) : undefined;
    const prefix = relationship.reviewed ? `Reviewed ${relationship.severity}` : relationship.severity;
    return `${prefix}: ${relationship.type}${relatedMember ? ` with ${relatedMember.name}` : ""}${forum ? ` in ${forum.name}` : ""}${relationship.reviewedAt ? ` (reviewed ${new Date(relationship.reviewedAt).toLocaleDateString()})` : ""}${relationship.notes ? ` - ${relationship.notes}` : ""}`;
  });
  const summaryParts = [
    counts.Blocked ? `${counts.Blocked} Blocked` : "",
    counts["Reviewed Blocked"] ? `${counts["Reviewed Blocked"]} Reviewed Blocker` : "",
    counts["Needs Review"] ? `${counts["Needs Review"]} Needs Review` : "",
    counts["Reviewed Needs Review"] ? `${counts["Reviewed Needs Review"]} Reviewed` : "",
    counts["Note Only"] ? `${counts["Note Only"]} Note Only` : ""
  ].filter(Boolean);
  return {
    count: related.length,
    summary: `${related.length} conflict${related.length === 1 ? "" : "s"}: ${summaryParts.join(", ")}`,
    highestSeverity: highest,
    details
  };
};
