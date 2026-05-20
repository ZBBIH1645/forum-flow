import { forums, freeAgents, getForumMembers, memberRelationships } from "./mock-data";
import type { CompatibilityLabel, CompatibilityReview, ForumGroup, Member, MemberRelationship } from "./types";

const revenueRank: Record<string, number> = {
  "$1M-$3M": 1,
  "$3M-$10M": 2,
  "$10M-$25M": 3,
  "$25M+": 4
};

const rangesFrom = (values: string[]) => Array.from(new Set(values)).join(", ");

const ageLabelFromAges = (values: number[]) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return "N/A";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return min === max ? String(min) : `${min}-${max}`;
};

const revenueRangeLabel = (values: string[]) => {
  const sorted = values
    .map((value) => ({ value, rank: revenueRank[value] }))
    .filter((item) => item.rank)
    .sort((a, b) => a.rank - b.rank);
  const low = sorted[0]?.value;
  const high = sorted[sorted.length - 1]?.value;

  if (!low || !high) return "N/A";
  if (low === high) return low.replace("$", "");

  const lowStart = low.split("-")[0].replace("$", "");
  const highEnd = high.includes("+") ? high.replace("$", "") : high.split("-")[1].replace("$", "");
  return `${lowStart}-${highEnd}`;
};
export const getOpenSeats = (forum: ForumGroup) => Math.max(0, forum.maxDesiredSize - forum.currentMemberIds.length);

export const getForumMembersFromData = (forum: ForumGroup, members: Member[]) =>
  members.filter((member) => member.currentForumId === forum.id);

export const getOpenSeatsFromMembers = (forum: ForumGroup, members: Member[]) =>
  Math.max(0, forum.maxDesiredSize - getForumMembersFromData(forum, members).length);

export const buildForumsFromMembers = (baseForums: ForumGroup[], members: Member[]): ForumGroup[] =>
  baseForums.map((forum) => ({
    ...forum,
    currentMemberIds: members.filter((member) => member.currentForumId === forum.id).map((member) => member.id)
  }));

export const getForumCompositionFromData = (forum: ForumGroup, members: Member[]) => {
  const forumMembers = getForumMembersFromData(forum, members);
  const industries = Array.from(new Set(forumMembers.map((member) => member.industry)));
  const genderMix = forumMembers.reduce<Record<string, number>>((mix, member) => {
    mix[member.gender] = (mix[member.gender] ?? 0) + 1;
    return mix;
  }, {});

  return {
    members: forumMembers,
    industries,
    genderMix,
    ageRange: ageLabelFromAges(forumMembers.map((member) => member.age)),
    revenueRange: revenueRangeLabel(forumMembers.map((member) => member.revenueRange)),
    yearsRange: forumMembers.length
      ? `${Math.min(...forumMembers.map((member) => member.yearsInBusiness))}-${Math.max(...forumMembers.map((member) => member.yearsInBusiness))} years`
      : "N/A",
    stageProfile: rangesFrom(forumMembers.map((member) => member.businessStage))
  };
};

export const getForumComposition = (forum: ForumGroup) => getForumCompositionFromData(forum, getForumMembers(forum));

const memberName = (memberId: string, members: Member[]) => members.find((member) => member.id === memberId)?.name ?? memberId;

const relationshipMessage = (relationship: MemberRelationship, relatedName: string) => {
  if (relationship.type === "Blood relative") return `Blood relative in group: ${relatedName}.`;
  if (relationship.type === "Spouse") return `Spouse in group: ${relatedName}.`;
  if (relationship.type === "Current business partner") return `Current business partner in group: ${relatedName}.`;
  if (relationship.type === "Former business partner") return `Former business partner in group: ${relatedName}.`;
  if (relationship.type === "Prior business relationship") return `Major previous business relationship in group: ${relatedName}.`;
  if (relationship.type === "Direct competitor") return `Direct competitor in group: ${relatedName}.`;
  if (relationship.type === "Close friend") return `Very close friend in group: ${relatedName}.`;
  if (relationship.type === "Personal conflict") return `Major personal conflict in group: ${relatedName}.`;
  return `Relationship note in group: ${relatedName}.`;
};

export const reviewCompatibilityWithData = (
  member: Member,
  forum: ForumGroup,
  allMembers: Member[],
  relationships: MemberRelationship[] = []
): CompatibilityReview => {
  const forumMembers = getForumMembersFromData(forum, allMembers);
  const memberIds = new Set(forum.currentMemberIds);
  const hardBlockers: string[] = [];
  const softWarnings: string[] = [];
  const positiveSignals: string[] = [];
  const openSeats = Math.max(0, forum.maxDesiredSize - forumMembers.length);
  const industryCount = forumMembers.filter((forumMember) => forumMember.industry === member.industry).length;
  const avgRevenue = forumMembers.reduce((sum, forumMember) => sum + revenueRank[forumMember.revenueRange], 0) / forumMembers.length;
  const avgAge = forumMembers.reduce((sum, forumMember) => sum + forumMember.age, 0) / forumMembers.length;
  const avgYears = forumMembers.reduce((sum, forumMember) => sum + forumMember.yearsInBusiness, 0) / forumMembers.length;

  for (const relationship of relationships) {
    const relatedId = relationship.memberId === member.id ? relationship.relatedMemberId : relationship.relatedMemberId === member.id ? relationship.memberId : "";
    if (!relatedId || !memberIds.has(relatedId)) continue;
    const message = relationshipMessage(relationship, memberName(relatedId, forumMembers));
    if (relationship.severity === "Blocked") hardBlockers.push(message);
    else if (relationship.severity === "Needs Review") softWarnings.push(message);
  }

  if (openSeats > 0) positiveSignals.push(`${openSeats} open ${openSeats === 1 ? "seat" : "seats"}.`);
  else softWarnings.push("Forum is currently full.");

  if (member.homeLocation === forum.mainLocationZone || member.businessLocation === forum.mainLocationZone) {
    positiveSignals.push("Home or business location is close to the Forum zone.");
  }

  if (member.forumStylePreference === forum.forumStyle) positiveSignals.push("Forum style matches member preference.");

  if (industryCount === 0) positiveSignals.push(`${member.industry} adds industry variety.`);
  else if (industryCount >= 2) softWarnings.push(`${member.industry} is already overrepresented.`);

  if (Math.abs(revenueRank[member.revenueRange] - avgRevenue) <= 1) positiveSignals.push("Revenue range is broadly compatible.");
  else softWarnings.push("Big revenue mismatch.");

  if (Math.abs(member.age - avgAge) <= 10) positiveSignals.push("Age/life stage is broadly compatible.");
  else softWarnings.push("Big age mismatch.");

  if (Math.abs(member.yearsInBusiness - avgYears) <= 8) positiveSignals.push("Years in business are within a reasonable range.");
  else softWarnings.push("Big years-in-business mismatch.");

  if (forum.groupNotes.includes("20+ year operators") && member.yearsInBusiness < 10) {
    softWarnings.push("Group skews toward 20+ year operators; member is earlier-stage.");
  }
  if (forum.specialExpectations.includes("$5K") && revenueRank[member.revenueRange] <= 2) {
    softWarnings.push("Group has expensive travel/social expectations.");
  }

  const genderCount = forumMembers.filter((forumMember) => forumMember.gender === member.gender).length + 1;
  if (forumMembers.length >= 7 && genderCount / (forumMembers.length + 1) > 0.85) softWarnings.push("Gender balance becomes very tilted.");

  let label: CompatibilityLabel;
  if (hardBlockers.length > 0) label = "Blocked";
  else if (softWarnings.some((warning) => warning.includes("Direct competitor")) || softWarnings.length >= 5) label = "Needs Review";
  else if (positiveSignals.length >= 6 && softWarnings.length <= 1) label = "Best Fit";
  else if (positiveSignals.length >= 4 && softWarnings.length <= 2) label = "Good Fit";
  else label = "Possible Fit";

  return {
    member,
    forum,
    label,
    positiveSignals,
    hardBlockers,
    softWarnings,
    summary: label === "Blocked"
      ? "Hard blocker found. Do not approve without changing the Forum selection."
      : label === "Needs Review"
        ? "Review flagged relationships or major mismatches before approving."
        : "Review fit signals and use placement judgment."
  };
};

export const reviewCompatibility = (member: Member, forum: ForumGroup): CompatibilityReview =>
  reviewCompatibilityWithData(member, forum, getForumMembers(forum), memberRelationships);

const labelRank: Record<CompatibilityLabel, number> = {
  "Best Fit": 5,
  "Good Fit": 4,
  "Possible Fit": 3,
  "Needs Review": 2,
  Blocked: 1
};

export const getForumMatchesForMember = (member: Member) =>
  forums
    .map((forum) => reviewCompatibilityWithData(member, forum, freeAgents.concat(forums.flatMap(getForumMembers)), memberRelationships))
    .sort((a, b) => labelRank[b.label] - labelRank[a.label] || getOpenSeats(b.forum) - getOpenSeats(a.forum));

export const getForumMatchesForMemberFromData = (
  member: Member,
  currentForums: ForumGroup[],
  members: Member[],
  relationships: MemberRelationship[]
) =>
  currentForums
    .map((forum) => reviewCompatibilityWithData(member, forum, members, relationships))
    .sort((a, b) => labelRank[b.label] - labelRank[a.label] || getOpenSeatsFromMembers(b.forum, members) - getOpenSeatsFromMembers(a.forum, members));

export const getFreeAgentMatchesForForum = (forum: ForumGroup) =>
  freeAgents
    .map((member) => reviewCompatibility(member, forum))
    .sort((a, b) => labelRank[b.label] - labelRank[a.label] || a.softWarnings.length - b.softWarnings.length);

export const getFreeAgentMatchesForForumFromData = (
  forum: ForumGroup,
  members: Member[],
  relationships: MemberRelationship[]
) =>
  members
    .filter((member) => !member.currentForumId && !member.assignedForumId && member.status !== "Former Member")
    .map((member) => reviewCompatibilityWithData(member, forum, members, relationships))
    .sort((a, b) => labelRank[b.label] - labelRank[a.label] || a.softWarnings.length - b.softWarnings.length);
