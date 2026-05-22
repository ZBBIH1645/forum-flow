import type { ForumGroup, MemberStatus } from "./types";
import { normalizeSearchText } from "./search";
import { normalizeSouthFloridaLocation } from "./locations";

export type NormalizedValue<T> = {
  value?: T;
  needsReview?: boolean;
  warning?: string;
};

const emptyToUndefined = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const titleCase = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.length <= 2 && part === part.toUpperCase() ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export const normalizeOptionalText = (raw: string): string | undefined => emptyToUndefined(raw.replace(/\s+/g, " "));

export const normalizeName = (raw: string): NormalizedValue<string> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  return { value: titleCase(value) };
};

export const normalizeCompanyName = (raw: string): NormalizedValue<string> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  return { value: value.replace(/\s+/g, " ") };
};

const industryAliases: Record<string, string> = {
  construction: "Construction",
  constrction: "Construction",
  finance: "Finance",
  financialservices: "Finance",
  healthcare: "Medical Practice",
  health: "Medical Practice",
  medical: "Medical Practice",
  marketingadvertising: "Marketing",
  professionalservices: "Professional Services",
  realestate: "Real Estate",
  wealthmanagement: "Wealth Management"
};

export const normalizeIndustryLabel = (raw: string): NormalizedValue<string> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  const key = normalizeSearchText(value).replaceAll(" ", "");
  return { value: industryAliases[key] ?? titleCase(value) };
};

export const normalizeLocationLabel = (raw: string): NormalizedValue<string> => {
  return normalizeSouthFloridaLocation(raw);
};

export const normalizeForumReference = (raw: string, forums: ForumGroup[]): NormalizedValue<{ name: string; forumId: string }> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  const normalized = normalizeSearchText(value);
  const exact = forums.find((forum) => normalizeSearchText(forum.name) === normalized);
  if (exact) return { value: { name: exact.name, forumId: exact.id } };
  const withoutForum = normalized.replace(/\bforum\b/g, "").trim();
  const loose = forums.find((forum) => normalizeSearchText(forum.name).replace(/\bforum\b/g, "").trim() === withoutForum);
  if (loose) return { value: { name: loose.name, forumId: loose.id } };
  return { needsReview: true, warning: `Unknown Forum: ${value}` };
};

export const normalizeRevenueRange = (raw: string): NormalizedValue<string> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  const key = normalizeSearchText(value).replaceAll(" ", "");
  const aliases: Record<string, string> = {
    "1m3m": "$1M-$3M",
    "$1m$3m": "$1M-$3M",
    "$1m-$3m": "$1M-$3M",
    "3m10m": "$3M-$10M",
    "$3m$10m": "$3M-$10M",
    "$3m-$10m": "$3M-$10M",
    "10m25m": "$10M-$25M",
    "$10m$25m": "$10M-$25M",
    "$10m-$25m": "$10M-$25M",
    "25m": "$25M+",
    "25m+": "$25M+",
    "$25m+": "$25M+",
    "over25m": "$25M+"
  };
  if (aliases[key]) return { value: aliases[key] };
  if (["$1M-$3M", "$3M-$10M", "$10M-$25M", "$25M+"].includes(value)) return { value };
  return { needsReview: true, warning: `Revenue range needs review: ${value}` };
};

export const normalizePositiveInteger = (raw: string): NormalizedValue<number> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  const cleaned = value.replace(/[, ]/g, "");
  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return { needsReview: true, warning: `Invalid number: ${value}` };
  return { value: parsed };
};

export const normalizeRelationshipReviewValue = (raw: string): NormalizedValue<boolean> => {
  const value = normalizeOptionalText(raw);
  if (!value) return { value: false };
  const key = normalizeSearchText(value).replaceAll(" ", "");
  if (["yes", "y", "true", "1", "complete", "completed", "done", "reviewed", "clear", "cleared"].includes(key)) return { value: true };
  if (["no", "n", "false", "0", "incomplete", "pending", "notreviewed", "needsreview"].includes(key)) return { value: false };
  return { value: false, needsReview: true, warning: `Relationship review value needs review: ${value}` };
};

const statusAliases: Record<string, MemberStatus> = {
  new: "New Member",
  newmember: "New Member",
  freeagent: "Free Agent",
  available: "Free Agent",
  inforum: "In Forum",
  forummember: "In Forum",
  member: "In Forum",
  needsinfo: "Needs Info",
  missinginfo: "Needs Info",
  needsconflictreview: "Needs Conflict Review",
  conflictreview: "Needs Conflict Review",
  readytoassign: "Ready To Assign",
  shortlisted: "Shortlisted",
  assignedpendingforumreview: "Assigned / Pending Forum Review",
  assigned: "Assigned / Pending Forum Review",
  pendingforumreview: "Assigned / Pending Forum Review",
  pendingapproval: "Pending Approval",
  rejected: "Rejected",
  assignmentexpired: "Assignment Expired",
  expired: "Assignment Expired",
  placed: "Placed",
  onhold: "On Hold",
  former: "Former Member",
  formermember: "Former Member"
};

export const normalizeMemberStatusValue = (raw: string): NormalizedValue<MemberStatus> => {
  const value = normalizeOptionalText(raw);
  if (!value) return {};
  const key = normalizeSearchText(value).replaceAll(" ", "");
  if (key === "pending") {
    return { needsReview: true, warning: "Ambiguous status 'pending' needs review." };
  }
  const status = statusAliases[key];
  if (status) return { value: status };
  return { needsReview: true, warning: `Unknown status: ${value}` };
};
