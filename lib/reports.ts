import { getAssignmentDaysLeft, getEffectiveStatus, isAssignmentExpired, isAssignmentExpiringSoon } from "./assignments";
import { computeDataQualityLabels, isStaleRecord } from "./data-quality";
import { getOpenSeatsFromMembers } from "./matching";
import type { LocalPlacementDecision } from "./local-placements";
import type { ActivityEvent, DataQualityLabel, DuplicateCase, ForumGroup, Member, MemberRelationship } from "./types";

export type AssignmentPipelineStatus =
  | "Pending Forum Review"
  | "Expiring Soon"
  | "Expired"
  | "Recently Confirmed In Forum"
  | "Recently Rejected";

export type AssignmentPipelineRow = {
  member: Member;
  company: string;
  forum?: ForumGroup;
  assignmentStartDate?: string;
  assignmentExpiresAt?: string;
  daysLeft: number | null;
  status: AssignmentPipelineStatus;
  recommendedAction: string;
  note?: string;
};

export type ForumCapacityRow = {
  forum: ForumGroup;
  confirmedCount: number;
  maxDesiredSize: number;
  openSeats: number;
  assignedPendingCount: number;
  shortlistedCount: number;
  capacityStatus: "Open" | "Nearly Full" | "Full" | "Over Capacity";
};

export const recentWithinDays = (iso: string | undefined, days: number, now = Date.now()) => {
  if (!iso) return false;
  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) && now - timestamp <= days * 24 * 60 * 60 * 1000;
};

export const buildExecutiveCounts = (
  members: Member[],
  relationships: MemberRelationship[],
  duplicateCases: DuplicateCase[]
) => {
  const activeMembers = members.filter((member) => member.status !== "Former Member");
  const dataQuality = activeMembers.map((member) => computeDataQualityLabels(member, relationships));
  const countLabel = (label: DataQualityLabel) => dataQuality.filter((labels) => labels.includes(label)).length;
  const hasOpenDuplicate = (member: Member) => duplicateCases.some((duplicate) =>
    duplicate.status !== "Not Duplicate" &&
    duplicate.status !== "Merged" &&
    duplicate.status !== "Archived" &&
    (duplicate.memberAId === member.id || duplicate.memberBId === member.id)
  );

  return {
    totalMembers: activeMembers.length,
    membersInForum: activeMembers.filter((member) => Boolean(member.currentForumId)).length,
    freeAgents: activeMembers.filter((member) => !member.currentForumId && !member.assignedForumId).length,
    newMembers: activeMembers.filter((member) => member.status === "New Member").length,
    readyToAssign: activeMembers.filter((member) => getEffectiveStatus(member) === "Ready To Assign").length,
    assignedPending: activeMembers.filter((member) => member.assignedForumId && getEffectiveStatus(member) === "Assigned / Pending Forum Review").length,
    assignmentsExpiringSoon: activeMembers.filter((member) => member.assignedForumId && isAssignmentExpiringSoon(member)).length,
    assignmentExpired: activeMembers.filter((member) => member.assignedForumId && (getEffectiveStatus(member) === "Assignment Expired" || isAssignmentExpired(member))).length,
    needsInfo: activeMembers.filter((member, index) =>
      member.status === "Needs Info" ||
      dataQuality[index].some((label) => label.startsWith("Missing ") && label !== "Missing Relationship Review")
    ).length,
    needsConflictReview: activeMembers.filter((member, index) =>
      member.status === "Needs Conflict Review" ||
      dataQuality[index].includes("Missing Relationship Review") ||
      dataQuality[index].includes("Has Hard Conflicts")
    ).length,
    possibleDuplicates: activeMembers.filter(hasOpenDuplicate).length,
    staleRecords: activeMembers.filter((member) => isStaleRecord(member)).length,
    missingRevenue: countLabel("Missing Revenue"),
    missingHomeLocation: countLabel("Missing Home Location"),
    missingBusinessLocation: countLabel("Missing Business Location"),
    missingYearsInBusiness: countLabel("Missing Years in Business"),
    missingDob: countLabel("Missing DOB"),
    missingIndustry: countLabel("Missing Industry"),
    missingRelationshipReview: countLabel("Missing Relationship Review"),
    hardConflicts: countLabel("Has Hard Conflicts")
  };
};

export const buildAssignmentPipeline = (
  members: Member[],
  forums: ForumGroup[],
  localPlacements: LocalPlacementDecision[]
): AssignmentPipelineRow[] => {
  const rows: AssignmentPipelineRow[] = members
    .filter((member) => member.assignedForumId)
    .map((member) => {
      const forum = forums.find((item) => item.id === member.assignedForumId);
      const daysLeft = getAssignmentDaysLeft(member);
      const expired = getEffectiveStatus(member) === "Assignment Expired" || isAssignmentExpired(member);
      const expiring = isAssignmentExpiringSoon(member);
      return {
        member,
        company: member.company,
        forum,
        assignmentStartDate: member.assignmentStartDate,
        assignmentExpiresAt: member.assignmentExpiresAt,
        daysLeft,
        status: expired ? "Expired" : expiring ? "Expiring Soon" : "Pending Forum Review",
        recommendedAction: expired
          ? "Return to Free Agent or reassign"
          : expiring
            ? "Follow up with Forum chair"
            : "Wait for Forum decision"
      };
    });

  for (const placement of localPlacements) {
    if (!recentWithinDays(placement.createdAt, 30)) continue;
    const member = members.find((item) => item.id === placement.memberId);
    const forum = forums.find((item) => item.id === placement.forumId);
    if (!member || !forum) continue;
    if (placement.status === "Confirmed" || placement.status === "Placed") {
      rows.push({
        member,
        company: member.company,
        forum,
        daysLeft: null,
        status: "Recently Confirmed In Forum",
        recommendedAction: "No action needed",
        note: placement.note || placement.reason
      });
    }
    if (placement.status === "Rejected" || placement.status === "Returned") {
      rows.push({
        member,
        company: member.company,
        forum,
        daysLeft: null,
        status: "Recently Rejected",
        recommendedAction: "Review next Forum option",
        note: placement.note || placement.reason
      });
    }
  }

  return rows.sort((a, b) => {
    const rank: Record<AssignmentPipelineStatus, number> = {
      Expired: 0,
      "Expiring Soon": 1,
      "Pending Forum Review": 2,
      "Recently Rejected": 3,
      "Recently Confirmed In Forum": 4
    };
    return rank[a.status] - rank[b.status] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
  });
};

export const buildForumCapacity = (
  forums: ForumGroup[],
  members: Member[],
  localPlacements: LocalPlacementDecision[]
): ForumCapacityRow[] =>
  forums.map((forum) => {
    const confirmedCount = members.filter((member) => member.currentForumId === forum.id).length;
    const openSeats = getOpenSeatsFromMembers(forum, members);
    const assignedPendingCount = members.filter((member) => member.assignedForumId === forum.id).length;
    const seenShortlists = new Set<string>();
    const shortlistedCount = localPlacements.filter((placement) => {
      if (placement.forumId !== forum.id || seenShortlists.has(placement.memberId)) return false;
      seenShortlists.add(placement.memberId);
      const member = members.find((item) => item.id === placement.memberId);
      return placement.status === "Shortlisted" && Boolean(member) && !member?.currentForumId && !member?.assignedForumId && member?.status !== "Former Member";
    }).length;
    const capacityStatus =
      confirmedCount > forum.maxDesiredSize ? "Over Capacity" :
      openSeats === 0 ? "Full" :
      openSeats === 1 ? "Nearly Full" :
      "Open";

    return {
      forum,
      confirmedCount,
      maxDesiredSize: forum.maxDesiredSize,
      openSeats,
      assignedPendingCount,
      shortlistedCount,
      capacityStatus
    };
  });

export const recentReportActivity = (activity: ActivityEvent[]) =>
  activity.filter((event) => [
    "Intake submitted",
    "Intake reviewed",
    "Member imported",
    "Possible duplicate flagged",
    "Duplicate merge completed",
    "Added to shortlist",
    "Member assigned to Forum",
    "Forum confirmed member",
    "Forum rejected member",
    "Assignment expired",
    "Relationship review completed",
    "Marked Ready To Assign"
  ].includes(event.type)).slice(0, 20);
