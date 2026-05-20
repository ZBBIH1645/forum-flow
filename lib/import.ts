import { computeDataQualityLabels, meetsRequiredFields } from "./data-quality";
import {
  normalizeCompanyName,
  normalizeForumReference,
  normalizeIndustryLabel,
  normalizeLocationLabel,
  normalizeMemberStatusValue,
  normalizeName,
  normalizeOptionalText,
  normalizePositiveInteger,
  normalizeRelationshipReviewValue,
  normalizeRevenueRange
} from "./data-normalization";
import type {
  BusinessStage,
  ForumGroup,
  ForumStyle,
  Gender,
  Member,
  MemberRelationship,
  MemberStatus
} from "./types";
import { normalizeHeader } from "./csv";

/**
 * Logical fields the wizard can map CSV columns to. A field may be required
 * for "Ready To Assign" (matches REQUIRED_FIELD_LABELS in lib/data-quality.ts)
 * or optional. Names map onto Member shape; combined fields (firstName+lastName)
 * are joined into Member.name.
 */
export type ImportField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "company"
  | "industry"
  | "homeLocation"
  | "businessLocation"
  | "dateOfBirth"
  | "gender"
  | "revenueRange"
  | "employeeCount"
  | "yearsInBusiness"
  | "businessStage"
  | "status"
  | "currentForum"
  | "forumStylePreference"
  | "relationshipReviewCompleted"
  | "notes";

export type FieldMapping = Partial<Record<ImportField, string>>; // value = CSV header

export const IMPORT_FIELDS: { id: ImportField; label: string; required: boolean; aliases: string[] }[] = [
  { id: "fullName", label: "Full name", required: false, aliases: ["name", "fullname", "membername", "member", "memberfullname"] },
  { id: "firstName", label: "First name", required: false, aliases: ["firstname", "first", "givenname"] },
  { id: "lastName", label: "Last name", required: false, aliases: ["lastname", "last", "surname", "familyname"] },
  { id: "company", label: "Company", required: false, aliases: ["company", "companyname", "business", "businessname", "organization", "org"] },
  { id: "industry", label: "Industry", required: true, aliases: ["industry", "sector", "industrylabel", "businesscategory"] },
  { id: "homeLocation", label: "Home location", required: true, aliases: ["homelocation", "home", "homecity", "residence", "residentialarea", "city"] },
  { id: "businessLocation", label: "Business location", required: true, aliases: ["businesslocation", "businesscity", "officelocation", "office", "officecity", "companycity"] },
  { id: "dateOfBirth", label: "Date of birth", required: true, aliases: ["dateofbirth", "dob", "birthdate", "birthday"] },
  { id: "gender", label: "Gender", required: false, aliases: ["gender", "sex"] },
  { id: "revenueRange", label: "Revenue range", required: true, aliases: ["revenuerange", "revenue", "annualrevenue"] },
  { id: "employeeCount", label: "Employee count", required: false, aliases: ["employeecount", "employees", "employee", "headcount", "staffcount", "staff"] },
  { id: "yearsInBusiness", label: "Years in business", required: true, aliases: ["yearsinbusiness", "years", "yearsbusiness", "yearsoperating", "yearsoperation", "yearsactive"] },
  { id: "businessStage", label: "Business stage", required: false, aliases: ["businessstage", "stage"] },
  { id: "status", label: "Status", required: false, aliases: ["status", "memberstatus", "placementstatus"] },
  { id: "currentForum", label: "Current Forum", required: false, aliases: ["currentforum", "forum", "forumname", "assignedforum", "forumgroup", "group"] },
  { id: "forumStylePreference", label: "Forum style preference", required: false, aliases: ["forumstylepreference", "forumstyle", "stylepreference"] },
  { id: "relationshipReviewCompleted", label: "Relationship review completed", required: false, aliases: ["relationshipreviewcompleted", "relationshipreview", "reviewcomplete", "conflictreviewcomplete", "relationshipreviewed", "conflictreviewed"] },
  { id: "notes", label: "Notes", required: false, aliases: ["notes", "comments", "remarks"] }
];

export const REQUIRED_IMPORT_FIELDS: ImportField[] = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.id);

export const SAMPLE_CSV =
  "Name,Company,Industry,Home Location,Business Location,Date Of Birth,Gender,Revenue Range,Employee Count,Years In Business,Business Stage,Status,Current Forum,Forum Style Preference,Relationship Review Completed,Notes\n" +
  "Jordan Lee,Lee Growth Group,Professional Services,Downtown,Downtown,1978-04-12,Woman,$3M-$10M,18,12,Growth,Free Agent,,Balanced,No,Returning member after sabbatical\n" +
  "Sam Patel,Patel Manufacturing,Manufacturing,Northside,West Loop,1969-11-02,Man,$10M-$25M,42,28,Mature,In Forum,Harbor Forum,Business-focused,Yes,Long-time operator\n" +
  "Riley Brooks,Brooks Studio,Arts Entertainment and Recreation,Eastside,Eastside,,Woman,$1M-$3M,5,3,Startup,New Member,,Personal/deeper discussion,No,Missing DOB on legacy record";

/**
 * Suggest a mapping from CSV headers → ImportField using normalised exact match
 * against `IMPORT_FIELDS[].aliases`. Returns the first header per field that matches
 * (later headers do not override earlier ones).
 */
export const suggestMapping = (headers: string[]): FieldMapping => {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    for (const header of headers) {
      if (used.has(header)) continue;
      if (field.aliases.includes(normalizeHeader(header))) {
        mapping[field.id] = header;
        used.add(header);
        break;
      }
    }
  }
  return mapping;
};

const REVENUE_OPTIONS = ["$1M-$3M", "$3M-$10M", "$10M-$25M", "$25M+"] as const;
const STAGE_OPTIONS: BusinessStage[] = ["Startup", "Growth", "Scaling", "Mature", "Transition"];
const STYLE_OPTIONS: ForumStyle[] = ["Business-focused", "Balanced", "Personal/deeper discussion", "Social/travel-heavy"];
const STATUS_OPTIONS: MemberStatus[] = [
  "New Member", "Free Agent", "In Forum", "Needs Info", "Needs Conflict Review",
  "Ready To Assign", "Shortlisted", "Pending Approval", "Assigned / Pending Forum Review",
  "Rejected", "Assignment Expired", "Placed", "On Hold", "Former Member"
];

const matchEnum = <T extends string>(raw: string, options: readonly T[]): T | undefined => {
  const target = raw.trim().toLowerCase();
  if (!target) return undefined;
  return options.find((option) => option.toLowerCase() === target)
    ?? options.find((option) => option.toLowerCase().includes(target) || target.includes(option.toLowerCase()));
};

const parseGender = (raw: string): Gender | undefined => {
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  if (t === "f" || t === "female" || t === "woman") return "Woman";
  if (t === "m" || t === "male" || t === "man") return "Man";
  return undefined;
};

const parseBoolean = (raw: string): boolean | undefined => {
  return normalizeRelationshipReviewValue(raw).value;
};

const parseInteger = (raw: string): number | undefined => {
  return normalizePositiveInteger(raw).value;
};

/**
 * Accepts YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, M/D/YYYY. Returns ISO YYYY-MM-DD or undefined.
 * Rejects clearly invalid dates (e.g., 1900-13-40, future dates beyond today + 1y).
 */
export const parseDateOfBirth = (raw: string): { iso?: string; valid: boolean; reason?: string } => {
  const t = raw.trim();
  if (!t) return { valid: true }; // Empty is allowed; required-field check is separate.
  let y: number | undefined; let m: number | undefined; let d: number | undefined;
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t);
  const us = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(t);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (us) { y = +us[3]; m = +us[1]; d = +us[2]; }
  else return { valid: false, reason: "Unrecognised date format (use YYYY-MM-DD or MM/DD/YYYY)." };
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > new Date().getUTCFullYear() + 1) {
    return { valid: false, reason: "Date out of range." };
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { valid: false, reason: "Calendar-invalid date (e.g., Feb 30)." };
  }
  return { iso: `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`, valid: true };
};

const calcAge = (iso?: string): number => {
  if (!iso) return 0;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  let years = now.getUTCFullYear() - date.getUTCFullYear();
  const mDiff = now.getUTCMonth() - date.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < date.getUTCDate())) years -= 1;
  return Math.max(0, years);
};

const ageRangeFor = (age: number): string =>
  age >= 60 ? "60+" : age >= 50 ? "50-59" : age >= 40 ? "40-49" : "30-39";

export type RowValueMap = Partial<Record<ImportField, string>>;

/** Apply mapping to a single CSV row, producing an object keyed by ImportField. */
export const applyMapping = (headers: string[], row: string[], mapping: FieldMapping): RowValueMap => {
  const out: RowValueMap = {};
  for (const field of IMPORT_FIELDS) {
    const header = mapping[field.id];
    if (!header) continue;
    const idx = headers.indexOf(header);
    if (idx < 0) continue;
    out[field.id] = row[idx] ?? "";
  }
  return out;
};

export type RowAction = "create" | "update" | "skip";

export type RowOutcome = {
  rowNumber: number;
  values: RowValueMap;
  /** Resolved name (firstName+lastName joined, or fullName trimmed). */
  name: string;
  duplicates: Member[];
  /** When defined, this row is treated as an update target by default. */
  matchedExistingId?: string;
  missingRequired: ImportField[];
  invalidDob: boolean;
  invalidDobReason?: string;
  invalidNumberFields: ImportField[];
  statusNeedsReview: boolean;
  statusWarning?: string;
  relationshipReviewWarning?: string;
  revenueWarning?: string;
  unknownForum: boolean;
  unknownForumName?: string;
  needsRelationshipReview: boolean;
  /** Default action if user does not override; reflects defaults rules in the spec. */
  defaultAction: RowAction;
  /** User override per row (defaults to defaultAction). */
  action: RowAction;
};

const resolveName = (values: RowValueMap): string => {
  const full = normalizeName(values.fullName ?? "").value;
  if (full) return full;
  const first = normalizeName(values.firstName ?? "").value ?? "";
  const last = normalizeName(values.lastName ?? "").value ?? "";
  return `${first} ${last}`.trim();
};

/**
 * Find duplicates against an existing member set using the spec's rules:
 *   - same or similar name
 *   - same company
 *   - same name + company
 *   - same name + DOB (if DOB present)
 * Mirrors `findPossibleDuplicates` in live-data-provider but extends with DOB.
 */
export const findDuplicatesForRow = (values: RowValueMap, existing: Member[]): Member[] => {
  const name = resolveName(values).toLowerCase();
  const company = (values.company ?? "").trim().toLowerCase();
  const dob = parseDateOfBirth(values.dateOfBirth ?? "").iso;
  if (!name && !company) return [];
  return existing.filter((member) => {
    const eName = member.name.toLowerCase();
    const eCompany = member.company.toLowerCase();
    const nameMatch = name.length > 0 && (eName === name || eName.includes(name) || name.includes(eName));
    const companyMatch = company.length > 0 && eCompany === company;
    const dobMatch = dob && member.dateOfBirth === dob && nameMatch;
    return nameMatch || companyMatch || dobMatch;
  }).slice(0, 4);
};

/** Build the per-row analysis used by Preview + Impact + Commit steps. */
export const analyzeRows = (
  rows: string[][],
  rowNumbers: number[],
  headers: string[],
  mapping: FieldMapping,
  existing: Member[],
  forums: ForumGroup[]
): RowOutcome[] => {
  return rows.map((row, idx) => {
    const values = applyMapping(headers, row, mapping);
    const name = resolveName(values);
    const duplicates = findDuplicatesForRow(values, existing);
    const matchedExistingId = duplicates[0]?.id;
    const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => !(values[field] ?? "").trim());
    const dobRaw = values.dateOfBirth ?? "";
    const dobResult = parseDateOfBirth(dobRaw);
    const invalidDob = !dobResult.valid;
    const currentForumRaw = (values.currentForum ?? "").trim();
    const forumResult = normalizeForumReference(currentForumRaw, forums);
    const unknownForum = currentForumRaw.length > 0 && !forumResult.value;
    const statusResult = normalizeMemberStatusValue(values.status ?? "");
    const relationshipResult = normalizeRelationshipReviewValue(values.relationshipReviewCompleted ?? "");
    const revenueResult = normalizeRevenueRange(values.revenueRange ?? "");
    const invalidNumberFields: ImportField[] = [];
    if ((values.employeeCount ?? "").trim() && !normalizePositiveInteger(values.employeeCount ?? "").value) invalidNumberFields.push("employeeCount");
    if ((values.yearsInBusiness ?? "").trim() && !normalizePositiveInteger(values.yearsInBusiness ?? "").value) invalidNumberFields.push("yearsInBusiness");
    const reviewParsed = relationshipResult.value;
    const needsRelationshipReview = reviewParsed !== true;

    const defaultAction: RowAction =
      !name ? "skip" :
      duplicates.length > 0 ? "skip" :
      "create";

    return {
      rowNumber: rowNumbers[idx],
      values,
      name,
      duplicates,
      matchedExistingId,
      missingRequired,
      invalidDob,
      invalidDobReason: dobResult.reason,
      invalidNumberFields,
      statusNeedsReview: Boolean((values.status ?? "").trim()) && (!statusResult.value || statusResult.needsReview === true),
      statusWarning: statusResult.warning,
      relationshipReviewWarning: relationshipResult.warning,
      revenueWarning: revenueResult.warning,
      unknownForum,
      unknownForumName: unknownForum ? currentForumRaw : undefined,
      needsRelationshipReview,
      defaultAction,
      action: defaultAction
    };
  });
};

/**
 * Pick the imported member's status given parsed CSV value + spec rules:
 *   - explicit valid status wins, EXCEPT
 *   - "In Forum" only if currentForum maps to a known forum
 *   - "Ready To Assign" only if data-quality rules pass (caller handles this after build)
 *   - missing/invalid → "New Member" if no required fields missing,
 *     otherwise "Needs Info"
 */
const resolveStatus = (
  rawStatus: string,
  forumKnown: boolean,
  hasMissingRequired: boolean
): MemberStatus => {
  const matched = normalizeMemberStatusValue(rawStatus).value ?? matchEnum(rawStatus, STATUS_OPTIONS);
  if (matched === "In Forum" && !forumKnown) return hasMissingRequired ? "Needs Info" : "New Member";
  if (matched === "Ready To Assign") return hasMissingRequired ? "Needs Info" : "Free Agent"; // Ready To Assign is granted by markReadyToAssign, not by import.
  if (matched) return matched;
  return hasMissingRequired ? "Needs Info" : "New Member";
};

/**
 * Build a Member from an outcome. Caller decides whether to use this for create
 * or to merge it into an existing member (update). Returns the synthesised draft
 * plus the set of fields that would change vs `baseline` (used for "will overwrite" UX).
 */
export const buildMemberFromRow = (
  outcome: RowOutcome,
  forums: ForumGroup[],
  baseline?: Member
): { draft: Member; overwrites: { field: keyof Member; from: unknown; to: unknown }[] } => {
  const v = outcome.values;
  const dobIso = parseDateOfBirth(v.dateOfBirth ?? "").iso;
  const forumReference = normalizeForumReference(v.currentForum ?? "", forums).value;
  const matchedForum = forumReference ? forums.find((f) => f.id === forumReference.forumId) : undefined;
  const forumKnown = !!matchedForum;
  const status = resolveStatus(v.status ?? "", forumKnown, outcome.missingRequired.length > 0);
  const reviewCompleted = parseBoolean(v.relationshipReviewCompleted ?? "") === true;
  const age = calcAge(dobIso);
  const normalizedName = normalizeName(outcome.name).value;
  const normalizedCompany = normalizeCompanyName(v.company ?? "").value;
  const normalizedIndustry = normalizeIndustryLabel(v.industry ?? "").value;
  const normalizedBusinessLocation = normalizeLocationLabel(v.businessLocation ?? "").value;
  const normalizedHomeLocation = normalizeLocationLabel(v.homeLocation ?? "").value;
  const normalizedRevenue = normalizeRevenueRange(v.revenueRange ?? "").value;
  const normalizedNotes = normalizeOptionalText(v.notes ?? "");

  const draft: Member = {
    id: baseline?.id ?? `mem-import-${Date.now()}-${outcome.rowNumber}`,
    name: normalizedName || baseline?.name || "Unnamed import",
    company: normalizedCompany || baseline?.company || "",
    industry: normalizedIndustry || baseline?.industry || "",
    businessLocation: normalizedBusinessLocation || baseline?.businessLocation || "",
    homeLocation: normalizedHomeLocation || baseline?.homeLocation || "",
    gender: parseGender(v.gender ?? "") ?? baseline?.gender ?? "Woman",
    age: age || baseline?.age || 0,
    ageRange: age ? ageRangeFor(age) : (baseline?.ageRange ?? "30-39"),
    dateOfBirth: dobIso ?? baseline?.dateOfBirth,
    revenueRange: normalizedRevenue ?? matchEnum(v.revenueRange ?? "", REVENUE_OPTIONS) ?? baseline?.revenueRange ?? "",
    employeeCount: parseInteger(v.employeeCount ?? "") ?? baseline?.employeeCount ?? 0,
    yearsInBusiness: parseInteger(v.yearsInBusiness ?? "") ?? baseline?.yearsInBusiness ?? 0,
    businessStage: matchEnum(v.businessStage ?? "", STAGE_OPTIONS) ?? baseline?.businessStage ?? "Growth",
    status: status,
    forumStylePreference: matchEnum(v.forumStylePreference ?? "", STYLE_OPTIONS) ?? baseline?.forumStylePreference ?? "Balanced",
    knownRelatives: baseline?.knownRelatives ?? [],
    spouseInChapter: baseline?.spouseInChapter ?? [],
    businessPartners: baseline?.businessPartners ?? [],
    previousBusinessRelationships: baseline?.previousBusinessRelationships ?? [],
    hardConflictMemberIds: baseline?.hardConflictMemberIds ?? [],
    directCompetitors: baseline?.directCompetitors ?? [],
    closeFriends: baseline?.closeFriends ?? [],
    notes: normalizedNotes || baseline?.notes || "",
    currentForumId: forumKnown && status === "In Forum" ? matchedForum!.id : baseline?.currentForumId,
    assignedForumId: baseline?.assignedForumId,
    assignmentStartDate: baseline?.assignmentStartDate,
    assignmentExpiresAt: baseline?.assignmentExpiresAt,
    rejectedForumIds: baseline?.rejectedForumIds,
    updatedAt: new Date().toISOString(),
    relationshipReviewCompleted: reviewCompleted || baseline?.relationshipReviewCompleted || false,
    relationshipReviewedAt: reviewCompleted ? new Date().toISOString() : baseline?.relationshipReviewedAt,
    intakeSubmittedAt: baseline?.intakeSubmittedAt,
    intakeDisclosures: baseline?.intakeDisclosures
  };

  const overwrites: { field: keyof Member; from: unknown; to: unknown }[] = [];
  if (baseline) {
    const watched: (keyof Member)[] = [
      "name", "company", "industry", "businessLocation", "homeLocation",
      "revenueRange", "businessStage", "status", "currentForumId",
      "forumStylePreference", "dateOfBirth", "notes"
    ];
    for (const key of watched) {
      const before = baseline[key];
      const after = draft[key];
      const isMeaningful = (val: unknown) => val !== undefined && val !== null && val !== "" && val !== 0;
      if (isMeaningful(before) && before !== after && isMeaningful(after)) {
        overwrites.push({ field: key, from: before, to: after });
      }
    }
  }

  return { draft, overwrites };
};

export type ImportImpact = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  duplicateRows: number;
  missingRequiredRows: number;
  invalidDobRows: number;
  invalidNumberRows: number;
  unknownForumRows: number;
  statusReviewRows: number;
  manualReviewRows: number;
  needsRelationshipReviewRows: number;
};

export const computeImpact = (outcomes: RowOutcome[]): ImportImpact => ({
  totalRows: outcomes.length,
  toCreate: outcomes.filter((o) => o.action === "create").length,
  toUpdate: outcomes.filter((o) => o.action === "update").length,
  toSkip: outcomes.filter((o) => o.action === "skip").length,
  duplicateRows: outcomes.filter((o) => o.duplicates.length > 0).length,
  missingRequiredRows: outcomes.filter((o) => o.missingRequired.length > 0).length,
  invalidDobRows: outcomes.filter((o) => o.invalidDob).length,
  invalidNumberRows: outcomes.filter((o) => o.invalidNumberFields.length > 0).length,
  unknownForumRows: outcomes.filter((o) => o.unknownForum).length,
  statusReviewRows: outcomes.filter((o) => o.statusNeedsReview).length,
  manualReviewRows: outcomes.filter((o) =>
    !o.name ||
    o.missingRequired.length > 0 ||
    o.invalidDob ||
    o.invalidNumberFields.length > 0 ||
    o.unknownForum ||
    o.statusNeedsReview ||
    Boolean(o.relationshipReviewWarning) ||
    Boolean(o.revenueWarning)
  ).length,
  needsRelationshipReviewRows: outcomes.filter((o) => o.needsRelationshipReview).length
});

/**
 * Final post-build check: if the synthesised member already meets data-quality
 * rules, bump status from "New Member"/"Needs Info" to "Free Agent" so it lands
 * naturally in the placement queue. NEVER auto-promote to "Ready To Assign" —
 * that's still operator-driven via the existing markReadyToAssign call.
 */
export const settleStatusAfterBuild = (
  draft: Member,
  relationships: MemberRelationship[]
): Member => {
  const labels = computeDataQualityLabels(draft, relationships);
  const ready = meetsRequiredFields(labels);
  if (!ready) return draft;
  if (draft.status === "Needs Info" || draft.status === "New Member") {
    return { ...draft, status: "Free Agent" };
  }
  return draft;
};
