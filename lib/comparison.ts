import { calculateAge } from "./assignments";
import { getForumMembersFromData } from "./matching";
import type { ForumGroup, Member, MemberRelationship } from "./types";

export type FitTone = "good" | "neutral" | "warning" | "bad";

export type FitField = {
  label: string;
  value: string;
  tone: FitTone;
};

const revenueRank: Record<string, number> = {
  "$1M-$3M": 1,
  "$3M-$10M": 2,
  "$10M-$25M": 3,
  "$25M+": 4
};

const average = (values: number[]) => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const compareMemberToForum = (
  member: Member,
  forum: ForumGroup,
  allMembers: Member[],
  relationships: MemberRelationship[]
): FitField[] => {
  const forumMembers = getForumMembersFromData(forum, allMembers);

  const locationFit: FitField = (() => {
    if (member.homeLocation === forum.mainLocationZone || member.businessLocation === forum.mainLocationZone) {
      return { label: "Location fit", value: `Same zone (${forum.mainLocationZone})`, tone: "good" };
    }
    return {
      label: "Location fit",
      value: `Different zones (member: ${member.homeLocation || "—"}, forum: ${forum.mainLocationZone})`,
      tone: "warning"
    };
  })();

  const revenueFit: FitField = (() => {
    if (forumMembers.length === 0) {
      return { label: "Revenue fit", value: `${member.revenueRange} (no benchmark)`, tone: "neutral" };
    }
    const memberRank = revenueRank[member.revenueRange] ?? 0;
    const avgRank = average(forumMembers.map((forumMember) => revenueRank[forumMember.revenueRange] ?? 0));
    const diff = Math.abs(memberRank - avgRank);
    if (diff <= 0.7) return { label: "Revenue fit", value: "Compatible with group avg", tone: "good" };
    if (diff <= 1.4) return { label: "Revenue fit", value: "Close to group avg", tone: "neutral" };
    return { label: "Revenue fit", value: "Big mismatch with group avg", tone: "warning" };
  })();

  const yearsFit: FitField = (() => {
    if (forumMembers.length === 0) {
      return { label: "Years-in-business fit", value: `${member.yearsInBusiness} yrs (no benchmark)`, tone: "neutral" };
    }
    const avgYears = average(forumMembers.map((forumMember) => forumMember.yearsInBusiness));
    const diff = Math.abs(member.yearsInBusiness - avgYears);
    if (diff <= 4) return { label: "Years-in-business fit", value: `${member.yearsInBusiness} yrs (group avg ${avgYears.toFixed(0)})`, tone: "good" };
    if (diff <= 8) return { label: "Years-in-business fit", value: `${member.yearsInBusiness} yrs (group avg ${avgYears.toFixed(0)})`, tone: "neutral" };
    return { label: "Years-in-business fit", value: `Big gap (member ${member.yearsInBusiness}, group avg ${avgYears.toFixed(0)})`, tone: "warning" };
  })();

  const ageFit: FitField = (() => {
    const memberAge = calculateAge(member);
    if (forumMembers.length === 0) {
      return { label: "Age / life-stage fit", value: `${memberAge} yrs (no benchmark)`, tone: "neutral" };
    }
    const ages = forumMembers.map((forumMember) => calculateAge(forumMember));
    const avgAge = average(ages);
    const diff = Math.abs(memberAge - avgAge);
    if (diff <= 6) return { label: "Age / life-stage fit", value: `${memberAge} yrs (group avg ${avgAge.toFixed(0)})`, tone: "good" };
    if (diff <= 12) return { label: "Age / life-stage fit", value: `${memberAge} yrs (group avg ${avgAge.toFixed(0)})`, tone: "neutral" };
    return { label: "Age / life-stage fit", value: `Big gap (member ${memberAge}, group avg ${avgAge.toFixed(0)})`, tone: "warning" };
  })();

  const industryOverlap: FitField = (() => {
    const sameIndustryCount = forumMembers.filter((forumMember) => forumMember.industry === member.industry).length;
    if (sameIndustryCount === 0) {
      return { label: "Industry overlap", value: `New industry (${member.industry})`, tone: "good" };
    }
    if (sameIndustryCount === 1) {
      return { label: "Industry overlap", value: `1 member already in ${member.industry}`, tone: "neutral" };
    }
    return { label: "Industry overlap", value: `${sameIndustryCount} members already in ${member.industry}`, tone: "warning" };
  })();

  const relationshipStatus: FitField = (() => {
    const memberIds = new Set(forum.currentMemberIds);
    const relevant = relationships.filter((relationship) => {
      const involvesMember = relationship.memberId === member.id || relationship.relatedMemberId === member.id;
      const otherId = relationship.memberId === member.id ? relationship.relatedMemberId : relationship.memberId;
      return involvesMember && memberIds.has(otherId);
    });
    if (relevant.length === 0) return { label: "Relationship status", value: "No conflicts with current members", tone: "good" };
    const blocked = relevant.filter((relationship) => relationship.severity === "Blocked").length;
    const review = relevant.filter((relationship) => relationship.severity === "Needs Review").length;
    if (blocked > 0) return { label: "Relationship status", value: `${blocked} hard blocker${blocked === 1 ? "" : "s"} with current members`, tone: "bad" };
    if (review > 0) return { label: "Relationship status", value: `${review} relationship${review === 1 ? "" : "s"} need review`, tone: "warning" };
    return { label: "Relationship status", value: `${relevant.length} note-only relationships`, tone: "neutral" };
  })();

  return [locationFit, revenueFit, yearsFit, ageFit, industryOverlap, relationshipStatus];
};

export const memberFitSnapshotForForum = (
  member: Member,
  forum: ForumGroup,
  allMembers: Member[],
  relationships: MemberRelationship[]
) => {
  const fields = compareMemberToForum(member, forum, allMembers, relationships);
  return Object.fromEntries(fields.map((field) => [field.label, field])) as Record<string, FitField>;
};

export const fitToneClass = (tone: FitTone) => {
  switch (tone) {
    case "good":
      return "bg-eo-teal/10 text-eo-teal";
    case "neutral":
      return "bg-slate-100 text-slate-700";
    case "warning":
      return "bg-amber-100 text-amber-900";
    case "bad":
      return "bg-rose-100 text-rose-800";
  }
};
