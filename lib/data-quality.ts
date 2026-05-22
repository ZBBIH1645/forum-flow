import type { DataQualityLabel, Member, MemberRelationship } from "./types";

export const STALE_RECORD_DAYS = 180;

/**
 * Required-fields rules for "Ready To Assign". A member must satisfy all of these
 * to be eligible for Forum assignment from the placement workflow.
 */
export const REQUIRED_FIELD_LABELS: DataQualityLabel[] = [
  "Missing Home Location",
  "Missing Business Location",
  "Missing Revenue",
  "Missing Years in Business",
  "Missing DOB",
  "Missing Industry",
  "Missing Relationship Review"
];

export const REQUIRED_FIELD_DETAILS: Record<DataQualityLabel, { field?: keyof Member; displayName: string; why: string }> = {
  "Missing Home Location": {
    field: "homeLocation",
    displayName: "Home Location",
    why: "Used to avoid impractical Forum placement geography."
  },
  "Missing Business Location": {
    field: "businessLocation",
    displayName: "Business Location",
    why: "Used to evaluate local market fit and business overlap."
  },
  "Missing Revenue": {
    field: "revenueRange",
    displayName: "Revenue Range",
    why: "Used to match members with peers at a comparable business scale."
  },
  "Missing Years in Business": {
    field: "yearsInBusiness",
    displayName: "Years in Business",
    why: "Used to match operating maturity and founder experience."
  },
  "Missing DOB": {
    field: "dateOfBirth",
    displayName: "Date of Birth",
    why: "Used to calculate age range for balanced Forum composition."
  },
  "Missing Industry": {
    field: "industry",
    displayName: "Industry",
    why: "Used to detect competitor conflicts and business diversity."
  },
  "Missing Relationship Review": {
    displayName: "Relationship Review",
    why: "Conflicts must be reviewed before assignment."
  },
  Complete: { displayName: "Complete", why: "All required placement fields are present." },
  "Has Hard Conflicts": { displayName: "Hard Conflicts", why: "Specific Forum pairings may be blocked." },
  "Possible Duplicate": { displayName: "Possible Duplicate", why: "Duplicate records should be merged before placement." },
  "Stale Record": { displayName: "Stale Record", why: "Older data should be refreshed before placement." },
  "Needs Review": { displayName: "Needs Review", why: "A placement reviewer should confirm next steps." }
};

export const isStaleRecord = (member: Member, now: number = Date.now()): boolean => {
  if (!member.updatedAt) return false;
  const updated = new Date(member.updatedAt).getTime();
  if (!Number.isFinite(updated)) return false;
  const ageDays = (now - updated) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_RECORD_DAYS;
};

export const daysSinceUpdate = (member: Member, now: number = Date.now()): number | null => {
  if (!member.updatedAt) return null;
  const updated = new Date(member.updatedAt).getTime();
  if (!Number.isFinite(updated)) return null;
  return Math.floor((now - updated) / (1000 * 60 * 60 * 24));
};

export const computeDataQualityLabels = (
  member: Member,
  relationships: MemberRelationship[]
): DataQualityLabel[] => {
  const labels: DataQualityLabel[] = [];

  if (!member.homeLocation) labels.push("Missing Home Location");
  if (!member.businessLocation) labels.push("Missing Business Location");
  if (!member.revenueRange) labels.push("Missing Revenue");
  if (!member.yearsInBusiness) labels.push("Missing Years in Business");
  if (!member.dateOfBirth) labels.push("Missing DOB");
  if (!member.industry) labels.push("Missing Industry");
  if (!member.relationshipReviewCompleted) labels.push("Missing Relationship Review");

  const memberRelationships = relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id);
  const blockedConflicts = memberRelationships.filter((relationship) => relationship.severity === "Blocked" && !relationship.reviewed);
  if (blockedConflicts.length > 0) labels.push("Has Hard Conflicts");

  const unresolvedReviewConflicts = memberRelationships.some((relationship) => relationship.severity === "Needs Review" && !relationship.reviewed);
  if (member.status === "Needs Info" || member.status === "Needs Conflict Review" || unresolvedReviewConflicts) labels.push("Needs Review");

  if (isStaleRecord(member)) labels.push("Stale Record");

  return labels.length ? labels : ["Complete"];
};

/**
 * A member is ready to assign when all required fields are present.
 * Stale Record and Has Hard Conflicts are warnings, not blockers
 * (a hard conflict only blocks specific Forum pairings, not assignment overall).
 */
export const meetsRequiredFields = (labels: DataQualityLabel[]): boolean =>
  REQUIRED_FIELD_LABELS.every((requirement) => !labels.includes(requirement)) && !labels.includes("Needs Review");

export const missingRequiredFields = (labels: DataQualityLabel[]): DataQualityLabel[] =>
  labels.filter((label) => REQUIRED_FIELD_LABELS.includes(label));

export const hasMissingRequiredFields = (labels: DataQualityLabel[]): boolean =>
  missingRequiredFields(labels).length > 0;

export const hasCompletedRequiredInfo = (labels: DataQualityLabel[]): boolean =>
  missingRequiredFields(labels).length === 0;
