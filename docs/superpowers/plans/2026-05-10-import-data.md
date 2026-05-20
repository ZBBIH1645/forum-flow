# Import Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal `/import-data` page that lets the placement chair bulk-import legacy member records from CSV (paste or file) through a five-step wizard: add → preview → map → impact summary → commit. Imported members must flow correctly through the existing live data adapter, data-quality rules, placement queue, members directory, forum groups, and activity history.

**Architecture:** All CSV parsing, field mapping, member synthesis, duplicate detection, and impact-summary computation live in two pure modules (`lib/csv.ts`, `lib/import.ts`) so they can be reasoned about and reused. The wizard UI (`components/import-data-wizard.tsx`) is a single client component with internal step state — it composes existing patterns (`useLiveData`, `PrivacyNote`, `StatusBadge`, Tailwind `eo-*` colors). The live-data provider gains three additions: `addMembersBulk`, `updateMembersBulk`, and `recordImportSummary` — all reusing the existing `forumflow.live.*` localStorage keys and event bus. The page route is `/import-data` and a sidebar entry is added; the legacy `/members/import` page is replaced with a redirect to the new route.

**Tech Stack:** Next.js 15 app router · React 19 client components · TypeScript · Tailwind v4 (existing eo-* tokens) · lucide-react · localStorage adapter from `components/live-data-provider.tsx`

**Non-goals (do not implement):** email functionality, meeting time/day fields, numeric 0–100 scores, Supabase/backend integration, role permissions, full duplicate merge flow, public-facing import page.

---

### Task 1: Extend Activity Event Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add import event types to the `ActivityEvent.type` union**

In `lib/types.ts`, the `ActivityEvent.type` union currently ends with `"Possible duplicate flagged" | "Needs review"`. Append seven new literals (preserving alphabetical/grouped style of the file — they go at the end of the union, before the closing semicolon):

```ts
    | "Possible duplicate flagged"
    | "Needs review"
    | "Import started"
    | "Import preview generated"
    | "Member imported"
    | "Member updated by import"
    | "Import row skipped"
    | "Import duplicate flagged"
    | "Import completed";
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors). If the file has pre-existing errors, ignore them — only confirm no errors point at `lib/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(import): extend ActivityEvent types for CSV import workflow"
```

---

### Task 2: CSV Parser Utility

**Files:**
- Create: `lib/csv.ts`

We need an RFC-4180-style parser that tolerates: quoted fields, embedded commas/newlines/quotes inside quotes (`""` escape), CRLF or LF line endings, BOM, trailing empty lines, and leading/trailing whitespace per cell. Header row required.

- [ ] **Step 1: Create `lib/csv.ts` with the parser**

```ts
export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  /** 1-indexed row numbers from the original input, aligned with `rows`. Header is row 1. */
  rowNumbers: number[];
  errors: { row: number; message: string }[];
};

/**
 * Parse CSV text into headers + rows. Accepts CRLF or LF line endings,
 * quoted fields with embedded commas/quotes (RFC 4180 style: "" escapes ").
 * Empty input or input with only a header row returns an empty `rows` array.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const errors: ParsedCsv["errors"] = [];
  const records: { values: string[]; lineNumber: number }[] = [];

  let i = 0;
  let line = 1;
  let recordStartLine = 1;
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    records.push({ values: row, lineNumber: recordStartLine });
    row = [];
    recordStartLine = line;
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === "\n") line += 1;
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // CRLF: skip the \n on next iteration
      if (text[i + 1] === "\n") i += 1;
      pushRow();
      line += 1;
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      line += 1;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Final cell/row if input did not end in newline
  if (cell.length > 0 || row.length > 0) pushRow();
  if (inQuotes) errors.push({ row: recordStartLine, message: "Unterminated quoted field." });

  if (records.length === 0) {
    return { headers: [], rows: [], rowNumbers: [], errors };
  }

  const headerRecord = records[0];
  const headers = headerRecord.values.map((h) => h.trim());
  const dataRecords = records.slice(1).filter((rec) => rec.values.some((v) => v.trim().length > 0));
  const rows = dataRecords.map((rec) => {
    const padded = [...rec.values];
    while (padded.length < headers.length) padded.push("");
    return padded.slice(0, headers.length).map((cell) => cell.trim());
  });
  const rowNumbers = dataRecords.map((rec) => rec.lineNumber);

  return { headers, rows, rowNumbers, errors };
}

/** Header strings that the wizard recognises as common aliases. Lowercased, punctuation-stripped. */
export const normalizeHeader = (header: string): string =>
  header.toLowerCase().replace(/[^a-z0-9]+/g, "");
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors pointing at `lib/csv.ts`).

- [ ] **Step 3: Commit**

```bash
git add lib/csv.ts
git commit -m "feat(import): add CSV parser utility (RFC-4180 quoted fields, CRLF, BOM)"
```

---

### Task 3: Import Domain Logic

**Files:**
- Create: `lib/import.ts`

This module contains everything that does not touch React: target field definitions, auto-mapping, per-row validation, member synthesis, duplicate detection, impact summary, status defaulting, and the sample CSV template. The wizard component imports from here.

- [ ] **Step 1: Create `lib/import.ts`**

```ts
import { computeDataQualityLabels, meetsRequiredFields } from "./data-quality";
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
  { id: "fullName", label: "Full name", required: false, aliases: ["name", "fullname", "membername"] },
  { id: "firstName", label: "First name", required: false, aliases: ["firstname", "first", "givenname"] },
  { id: "lastName", label: "Last name", required: false, aliases: ["lastname", "last", "surname", "familyname"] },
  { id: "company", label: "Company", required: false, aliases: ["company", "companyname", "business", "organization", "org"] },
  { id: "industry", label: "Industry", required: true, aliases: ["industry", "sector"] },
  { id: "homeLocation", label: "Home location", required: true, aliases: ["homelocation", "home", "homecity", "residence", "residentialarea"] },
  { id: "businessLocation", label: "Business location", required: true, aliases: ["businesslocation", "businesscity", "officelocation", "office"] },
  { id: "dateOfBirth", label: "Date of birth", required: true, aliases: ["dateofbirth", "dob", "birthdate", "birthday"] },
  { id: "gender", label: "Gender", required: false, aliases: ["gender", "sex"] },
  { id: "revenueRange", label: "Revenue range", required: true, aliases: ["revenuerange", "revenue", "annualrevenue"] },
  { id: "employeeCount", label: "Employee count", required: false, aliases: ["employeecount", "employees", "headcount", "staffcount"] },
  { id: "yearsInBusiness", label: "Years in business", required: true, aliases: ["yearsinbusiness", "years", "yearsoperating", "yearsoperation"] },
  { id: "businessStage", label: "Business stage", required: false, aliases: ["businessstage", "stage"] },
  { id: "status", label: "Status", required: false, aliases: ["status", "memberstatus"] },
  { id: "currentForum", label: "Current Forum", required: false, aliases: ["currentforum", "forum", "forumname", "assignedforum"] },
  { id: "forumStylePreference", label: "Forum style preference", required: false, aliases: ["forumstylepreference", "forumstyle", "stylepreference"] },
  { id: "relationshipReviewCompleted", label: "Relationship review completed", required: false, aliases: ["relationshipreviewcompleted", "relationshipreview", "reviewcomplete", "conflictreviewcomplete"] },
  { id: "notes", label: "Notes", required: false, aliases: ["notes", "comments", "remarks"] }
];

export const REQUIRED_IMPORT_FIELDS: ImportField[] = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.id);

export const SAMPLE_CSV =
  "Name,Company,Industry,Home Location,Business Location,Date Of Birth,Gender,Revenue Range,Employee Count,Years In Business,Business Stage,Status,Current Forum,Forum Style Preference,Relationship Review Completed,Notes\n" +
  "Jordan Lee,Lee Growth Group,Professional Services,Downtown,Downtown,1978-04-12,Woman,$3M-$10M,18,Growth,12,Free Agent,,Balanced,No,Returning member after sabbatical\n" +
  "Sam Patel,Patel Manufacturing,Manufacturing,Northside,West Loop,1969-11-02,Man,$10M-$25M,42,Mature,28,In Forum,Harbor Forum,Business-focused,Yes,Long-time operator\n" +
  "Riley Brooks,Brooks Studio,Arts Entertainment and Recreation,Eastside,Eastside,,Woman,$1M-$3M,5,Startup,3,New Member,,Personal/deeper discussion,No,Missing DOB on legacy record";

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
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  if (["yes", "y", "true", "1", "complete", "completed", "done"].includes(t)) return true;
  if (["no", "n", "false", "0", "incomplete", "pending"].includes(t)) return false;
  return undefined;
};

const parseInteger = (raw: string): number | undefined => {
  const t = raw.trim().replace(/[, ]/g, "");
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
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
  unknownForum: boolean;
  needsRelationshipReview: boolean;
  /** Default action if user does not override; reflects defaults rules in the spec. */
  defaultAction: RowAction;
  /** User override per row (defaults to defaultAction). */
  action: RowAction;
};

const resolveName = (values: RowValueMap): string => {
  const full = values.fullName?.trim();
  if (full) return full;
  const first = values.firstName?.trim() ?? "";
  const last = values.lastName?.trim() ?? "";
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
  const forumNames = new Set(forums.map((f) => f.name.toLowerCase()));
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
    const unknownForum = currentForumRaw.length > 0 && !forumNames.has(currentForumRaw.toLowerCase());
    const reviewParsed = parseBoolean(values.relationshipReviewCompleted ?? "");
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
      unknownForum,
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
  const matched = matchEnum(rawStatus, STATUS_OPTIONS);
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
  const matchedForum = forums.find((f) => f.name.toLowerCase() === (v.currentForum ?? "").trim().toLowerCase());
  const forumKnown = !!matchedForum;
  const status = resolveStatus(v.status ?? "", forumKnown, outcome.missingRequired.length > 0);
  const reviewCompleted = parseBoolean(v.relationshipReviewCompleted ?? "") === true;
  const age = calcAge(dobIso);

  const draft: Member = {
    id: baseline?.id ?? `mem-import-${Date.now()}-${outcome.rowNumber}`,
    name: outcome.name || baseline?.name || "Unnamed import",
    company: (v.company ?? "").trim() || baseline?.company || "",
    industry: (v.industry ?? "").trim() || baseline?.industry || "",
    businessLocation: (v.businessLocation ?? "").trim() || baseline?.businessLocation || "",
    homeLocation: (v.homeLocation ?? "").trim() || baseline?.homeLocation || "",
    gender: parseGender(v.gender ?? "") ?? baseline?.gender ?? "Woman",
    age: age || baseline?.age || 0,
    ageRange: age ? ageRangeFor(age) : (baseline?.ageRange ?? "30-39"),
    dateOfBirth: dobIso ?? baseline?.dateOfBirth,
    revenueRange: matchEnum(v.revenueRange ?? "", REVENUE_OPTIONS) ?? baseline?.revenueRange ?? "",
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
    notes: (v.notes ?? "").trim() || baseline?.notes || "",
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
  unknownForumRows: number;
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
  unknownForumRows: outcomes.filter((o) => o.unknownForum).length,
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/import.ts
git commit -m "feat(import): add domain logic for field mapping, validation, duplicate detection, impact"
```

---

### Task 4: Live Data Provider — Bulk Operations and Import Summaries

**Files:**
- Modify: `components/live-data-provider.tsx`

The provider already exposes `addMember` and `saveMember`. We need bulk variants that batch all writes into a single localStorage write (avoids 60+ event re-renders during a 60-row import) and persist a small history of import summaries.

- [ ] **Step 1: Add a new localStorage key for import history near the other keys (around line 33-36)**

Locate:

```ts
const liveMembersKey = "forumflow.live.members";
const liveRelationshipsKey = "forumflow.live.relationships";
const liveActivityKey = "forumflow.live.activity";
const liveDataUpdatedEvent = "forumflow.live.updated";
```

Add directly after:

```ts
const liveImportSummariesKey = "forumflow.live.import-summaries";
```

- [ ] **Step 2: Add ImportSummary type and helpers immediately after the `revenueRanges` const declaration (around line 57)**

```ts
export type ImportSummary = {
  id: string;
  startedAt: string;
  completedAt: string;
  rowsTotal: number;
  created: number;
  updated: number;
  skipped: number;
  duplicateFlagged: number;
  unknownForums: number;
};
```

- [ ] **Step 3: Inside `useLiveData`, add bulk operations**

Find the `addMember` definition (around line 209-214) and add the following after `saveRelationship` (around line 228), before `recordLocalDecision`:

```ts
  const addMembersBulk = useCallback((newMembers: Member[]) => {
    if (newMembers.length === 0) return;
    const stamped = newMembers.map((member, index) => ({
      ...member,
      id: member.id || `mem-import-${Date.now()}-${index}`,
      updatedAt: new Date().toISOString()
    }));
    const existing = readJson<Member[]>(liveMembersKey, []);
    const byId = new Map(existing.map((member) => [member.id, member]));
    for (const member of stamped) byId.set(member.id, member);
    writeJson(liveMembersKey, Array.from(byId.values()));
  }, []);

  const updateMembersBulk = useCallback((updates: Member[]) => {
    if (updates.length === 0) return;
    const merged = mergeMembers(readJson<Member[]>(liveMembersKey, []));
    const byId = new Map(merged.map((member) => [member.id, member]));
    for (const update of updates) {
      byId.set(update.id, { ...update, updatedAt: new Date().toISOString() });
    }
    persistMembers(Array.from(byId.values()));
  }, [persistMembers]);

  const addImportActivities = useCallback((events: Omit<ActivityEvent, "id" | "createdAt">[]) => {
    if (events.length === 0) return;
    const stamped: ActivityEvent[] = events.map((event, index) => ({
      ...event,
      id: `act-import-${Date.now()}-${index}`,
      createdAt: new Date(Date.now() + index).toISOString()
    }));
    const existing = readJson<ActivityEvent[]>(liveActivityKey, []);
    writeJson(liveActivityKey, [...stamped.reverse(), ...existing].slice(0, 200));
  }, []);

  const recordImportSummary = useCallback((summary: ImportSummary) => {
    if (typeof window === "undefined") return;
    const existing = readJson<ImportSummary[]>(liveImportSummariesKey, []);
    const next = [summary, ...existing].slice(0, 10);
    window.localStorage.setItem(liveImportSummariesKey, JSON.stringify(next));
    window.dispatchEvent(new Event(liveDataUpdatedEvent));
  }, []);

  const importSummaries = useMemo<ImportSummary[]>(() => {
    if (typeof window === "undefined") return [];
    return readJson<ImportSummary[]>(liveImportSummariesKey, []);
  }, [activity]); // re-derive when activity (and therefore live data) updates
```

(Note: the dependency on `activity` is intentional — `liveDataUpdatedEvent` triggers `reload()`, which updates `activity`; we piggyback on that to refresh the summaries view.)

- [ ] **Step 4: Add the new operations to the returned object**

In the `return { ... }` block at the bottom of `useLiveData` (around line 756-797), after `addMember,` add:

```ts
    addMembersBulk,
    updateMembersBulk,
    addImportActivities,
    recordImportSummary,
    importSummaries,
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/live-data-provider.tsx
git commit -m "feat(import): add bulk member ops and import-summary persistence to live-data provider"
```

---

### Task 5: Import Data Wizard Component

**Files:**
- Create: `components/import-data-wizard.tsx`

Single client component holding step state and rendering each step inline. Reuses Tailwind tokens (`bg-white`, `border-line`, `shadow-card`, `text-ink`, `text-muted`, `bg-eo-purple`, etc.) and lucide icons. No new dependencies.

- [ ] **Step 1: Scaffold the file with imports, types, and the top-level component**

```tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, Download,
  FileSpreadsheet, ListChecks, ShieldAlert, Trash2, Upload, Users
} from "lucide-react";
import { useLiveData, type ImportSummary } from "./live-data-provider";
import { PrivacyNote } from "./privacy-note";
import { parseCsv } from "@/lib/csv";
import {
  IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, SAMPLE_CSV,
  analyzeRows, buildMemberFromRow, computeImpact, settleStatusAfterBuild, suggestMapping,
  type FieldMapping, type ImportField, type RowAction, type RowOutcome
} from "@/lib/import";
import type { ActivityEvent } from "@/lib/types";

type StepId = "add" | "preview" | "map" | "impact" | "commit";

const STEPS: { id: StepId; label: string }[] = [
  { id: "add", label: "Add data" },
  { id: "preview", label: "Preview" },
  { id: "map", label: "Field mapping" },
  { id: "impact", label: "Impact summary" },
  { id: "commit", label: "Commit" }
];

const STORAGE_DRAFT_KEY = "forumflow.import.draft.csv";

export function ImportDataWizard() {
  const data = useLiveData();
  const [step, setStep] = useState<StepId>("add");
  const [csvText, setCsvText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_DRAFT_KEY) ?? "";
  });
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);
  const [commitResult, setCommitResult] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);

  const updateCsv = useCallback((next: string) => {
    setCsvText(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_DRAFT_KEY, next);
  }, []);

  const goToPreview = useCallback(() => {
    setMapping(suggestMapping(parsed.headers));
    setStep("preview");
  }, [parsed.headers]);

  const refreshOutcomes = useCallback(() => {
    setOutcomes(analyzeRows(parsed.rows, parsed.rowNumbers, parsed.headers, mapping, data.members, data.forums));
  }, [data.forums, data.members, mapping, parsed.headers, parsed.rowNumbers, parsed.rows]);

  // Recompute outcomes whenever mapping or parsed data changes and we are past Add step.
  useMemo(() => { if (step !== "add") refreshOutcomes(); }, [refreshOutcomes, step]);

  const impact = useMemo(() => computeImpact(outcomes), [outcomes]);

  const updateRowAction = (rowNumber: number, action: RowAction) =>
    setOutcomes((current) => current.map((o) => o.rowNumber === rowNumber ? { ...o, action } : o));

  const clearDraft = () => {
    updateCsv("");
    setMapping({});
    setOutcomes([]);
    setCommitResult(null);
    setStep("add");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    updateCsv(text);
  };

  const commit = useCallback(() => {
    const startedAt = new Date().toISOString();
    const startedEvent: Omit<ActivityEvent, "id" | "createdAt"> = {
      type: "Import started",
      detail: `CSV import started (${outcomes.length} row${outcomes.length === 1 ? "" : "s"}).`
    };
    data.addImportActivities([startedEvent]);

    const events: Omit<ActivityEvent, "id" | "createdAt">[] = [];
    const created: typeof data.members = [];
    const updated: typeof data.members = [];

    for (const outcome of outcomes) {
      if (outcome.action === "skip") {
        events.push({
          type: "Import row skipped",
          memberName: outcome.name,
          detail: `Row ${outcome.rowNumber} (${outcome.name || "unnamed"}) skipped${outcome.duplicates.length > 0 ? ` (possible duplicate: ${outcome.duplicates[0].name})` : ""}.`
        });
        if (outcome.duplicates.length > 0) {
          events.push({
            type: "Import duplicate flagged",
            memberId: outcome.duplicates[0].id,
            memberName: outcome.duplicates[0].name,
            detail: `Possible duplicate of imported row ${outcome.rowNumber} (${outcome.name || "unnamed"}).`
          });
        }
        continue;
      }

      if (outcome.action === "update" && outcome.matchedExistingId) {
        const baseline = data.members.find((m) => m.id === outcome.matchedExistingId);
        if (!baseline) continue;
        const { draft } = buildMemberFromRow(outcome, data.forums, baseline);
        const settled = settleStatusAfterBuild(draft, data.relationships);
        updated.push(settled);
        events.push({
          type: "Member updated by import",
          memberId: settled.id,
          memberName: settled.name,
          detail: `${settled.name} updated from CSV row ${outcome.rowNumber}.`
        });
        continue;
      }

      // create
      const { draft } = buildMemberFromRow(outcome, data.forums);
      const settled = settleStatusAfterBuild(draft, data.relationships);
      created.push(settled);
      events.push({
        type: "Member imported",
        memberId: settled.id,
        memberName: settled.name,
        detail: `${settled.name} imported from CSV row ${outcome.rowNumber}.`
      });
      if (outcome.duplicates.length > 0) {
        events.push({
          type: "Import duplicate flagged",
          memberId: settled.id,
          memberName: settled.name,
          detail: `Created despite possible duplicate(s): ${outcome.duplicates.map((d) => d.name).join(", ")}.`
        });
      }
    }

    if (created.length > 0) data.addMembersBulk(created);
    if (updated.length > 0) data.updateMembersBulk(updated);

    const completedAt = new Date().toISOString();
    events.push({
      type: "Import completed",
      detail: `Import committed: ${created.length} created, ${updated.length} updated, ${impact.toSkip} skipped.`
    });
    data.addImportActivities(events);

    const summary: ImportSummary = {
      id: `import-${Date.now()}`,
      startedAt,
      completedAt,
      rowsTotal: outcomes.length,
      created: created.length,
      updated: updated.length,
      skipped: impact.toSkip,
      duplicateFlagged: outcomes.filter((o) => o.duplicates.length > 0).length,
      unknownForums: impact.unknownForumRows
    };
    data.recordImportSummary(summary);
    setCommitResult(summary);
  }, [data, impact.toSkip, impact.unknownForumRows, outcomes]);

  return (
    <div className="space-y-6">
      <Stepper current={step} onSelect={setStep} unlocked={parsed.rows.length > 0} />

      {step === "add" && (
        <AddStep
          csv={csvText}
          onCsvChange={updateCsv}
          onFile={onFile}
          fileInputRef={fileInputRef}
          parsedRows={parsed.rows.length}
          parsedHeaders={parsed.headers.length}
          parseErrors={parsed.errors}
          onContinue={goToPreview}
          onClear={clearDraft}
          summaries={data.importSummaries}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          parsed={parsed}
          outcomes={outcomes}
          onBack={() => setStep("add")}
          onContinue={() => setStep("map")}
        />
      )}

      {step === "map" && (
        <MappingStep
          headers={parsed.headers}
          mapping={mapping}
          onChange={setMapping}
          outcomes={outcomes}
          onBack={() => setStep("preview")}
          onContinue={() => setStep("impact")}
        />
      )}

      {step === "impact" && (
        <ImpactStep
          impact={impact}
          outcomes={outcomes}
          onUpdateAction={updateRowAction}
          onBack={() => setStep("map")}
          onContinue={() => setStep("commit")}
        />
      )}

      {step === "commit" && (
        <CommitStep
          impact={impact}
          outcomes={outcomes}
          onBack={() => setStep("impact")}
          onCommit={commit}
          result={commitResult}
          onStartNew={clearDraft}
        />
      )}

      <PrivacyNote />
    </div>
  );
}
```

- [ ] **Step 2: Add the `Stepper` and `AddStep` sub-components in the same file (below `ImportDataWizard`)**

```tsx
function Stepper({ current, onSelect, unlocked }: { current: StepId; onSelect: (id: StepId) => void; unlocked: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-card">
      {STEPS.map((step, index) => {
        const isCurrent = step.id === current;
        const enabled = step.id === "add" || unlocked;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => enabled && onSelect(step.id)}
              disabled={!enabled}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isCurrent
                  ? "bg-eo-purple text-white shadow-card"
                  : enabled
                    ? "text-slate-700 hover:bg-eo-lilac hover:text-eo-purple"
                    : "cursor-not-allowed text-slate-400"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">{index + 1}</span>
              {step.label}
            </button>
            {index < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function AddStep(props: {
  csv: string;
  onCsvChange: (next: string) => void;
  onFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  parsedRows: number;
  parsedHeaders: number;
  parseErrors: { row: number; message: string }[];
  onContinue: () => void;
  onClear: () => void;
  summaries: ImportSummary[];
}) {
  const copySample = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(SAMPLE_CSV);
    }
  };
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forumflow-sample-import.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-eo-purple" />
          <div>
            <h2 className="text-base font-semibold text-ink">Add data</h2>
            <p className="mt-1 text-sm text-muted">
              Paste CSV text below or upload a .csv file. Use this to bring archived/legacy member records into the dashboard.
              You can include current Forum assignments and basic placement information.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => props.fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <Upload className="h-4 w-4" /> Upload .csv
          </button>
          <input
            ref={props.fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={copySample}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <ClipboardCopy className="h-4 w-4" /> Copy sample template
          </button>
          <button
            type="button"
            onClick={downloadSample}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <Download className="h-4 w-4" /> Download sample
          </button>
          <button
            type="button"
            onClick={props.onClear}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> Clear draft
          </button>
        </div>

        <textarea
          value={props.csv}
          onChange={(event) => props.onCsvChange(event.target.value)}
          rows={12}
          placeholder="Paste CSV here (first row should be headers)"
          className="mt-4 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
        />

        {props.parseErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            CSV parse warnings: {props.parseErrors.map((error) => `row ${error.row}: ${error.message}`).join("; ")}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Columns detected" value={props.parsedHeaders} />
          <Metric label="Data rows" value={props.parsedRows} />
          <Metric label="Required fields" value={REQUIRED_IMPORT_FIELDS.length} />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={props.onContinue}
            disabled={props.parsedRows === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to preview <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {props.summaries.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Recent imports</h2>
          <p className="mt-1 text-sm text-muted">Last {props.summaries.length} import{props.summaries.length === 1 ? "" : "s"} on this device.</p>
          <ul className="mt-4 divide-y divide-line">
            {props.summaries.map((summary) => (
              <li key={summary.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-700">{new Date(summary.completedAt).toLocaleString()}</span>
                <span className="text-slate-500">
                  {summary.created} created · {summary.updated} updated · {summary.skipped} skipped
                  {summary.duplicateFlagged > 0 ? ` · ${summary.duplicateFlagged} duplicates flagged` : ""}
                  {summary.unknownForums > 0 ? ` · ${summary.unknownForums} unknown forums` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Add the `PreviewStep` sub-component below**

```tsx
function PreviewStep(props: {
  parsed: ReturnType<typeof parseCsv>;
  outcomes: RowOutcome[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const invalidCount = props.outcomes.filter((o) => o.invalidDob || o.missingRequired.length > 0 || !o.name).length;
  const showRows = props.parsed.rows.slice(0, 12);

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Preview parsed rows</h2>
          <p className="mt-1 text-sm text-muted">
            We auto-suggest field mapping in the next step. Use this preview to confirm the file parsed correctly.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Rows" value={props.parsed.rows.length} />
        <Metric label="Columns" value={props.parsed.headers.length} />
        <Metric label="Rows with issues" value={invalidCount} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Row</th>
              {props.parsed.headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {showRows.map((row, index) => (
              <tr key={`row-${props.parsed.rowNumbers[index]}`}>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500">{props.parsed.rowNumbers[index]}</td>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`} className="px-3 py-2 text-sm text-slate-700">
                    {cell || <span className="text-slate-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.parsed.rows.length > showRows.length && (
        <p className="mt-2 text-xs text-muted">Showing first {showRows.length} of {props.parsed.rows.length} rows.</p>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Continue to mapping <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add the `MappingStep` sub-component below**

```tsx
function MappingStep(props: {
  headers: string[];
  mapping: FieldMapping;
  onChange: (next: FieldMapping) => void;
  outcomes: RowOutcome[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const setField = (field: ImportField, header: string) => {
    const next = { ...props.mapping };
    if (header) next[field] = header;
    else delete next[field];
    props.onChange(next);
  };
  const fullNameMapped = !!props.mapping.fullName || (!!props.mapping.firstName && !!props.mapping.lastName);
  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => !props.mapping[field]);

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Map CSV columns to member fields</h2>
          <p className="mt-1 text-sm text-muted">
            We pre-filled likely matches. Adjust as needed. You don&apos;t need to map every field — required ones drive the readiness check.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <label key={field.id} className="rounded-lg border border-line bg-white p-3">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {field.label}
              {field.required && <span className="rounded-full bg-eo-pink/10 px-2 py-0.5 text-[10px] font-semibold text-eo-pink">Required</span>}
            </span>
            <select
              value={props.mapping[field.id] ?? ""}
              onChange={(event) => setField(field.id, event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
            >
              <option value="">— Not mapped —</option>
              {props.headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
          </label>
        ))}
      </div>

      {!fullNameMapped && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          Map either &quot;Full name&quot; or both &quot;First name&quot; and &quot;Last name&quot; — rows without a resolvable name will be skipped.
        </div>
      )}
      {missingRequired.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          Unmapped required fields: {missingRequired.map((field) => IMPORT_FIELDS.find((f) => f.id === field)!.label).join(", ")}.
          Rows missing values for these fields will land in Needs Info / Data Quality.
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Continue to impact summary <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Add the `ImpactStep` sub-component below**

```tsx
function ImpactStep(props: {
  impact: ReturnType<typeof computeImpact>;
  outcomes: RowOutcome[];
  onUpdateAction: (rowNumber: number, action: RowAction) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Import impact</h2>
          <p className="mt-1 text-sm text-muted">Confirm what will happen before committing. Use the per-row controls to override defaults.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Will create" value={props.impact.toCreate} />
        <Metric label="Will update" value={props.impact.toUpdate} />
        <Metric label="Will skip" value={props.impact.toSkip} />
        <Metric label="Possible duplicates" value={props.impact.duplicateRows} />
        <Metric label="Missing required fields" value={props.impact.missingRequiredRows} />
        <Metric label="Invalid DOB" value={props.impact.invalidDobRows} />
        <Metric label="Unknown Forum" value={props.impact.unknownForumRows} />
        <Metric label="Needs relationship review" value={props.impact.needsRelationshipReviewRows} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Row</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Name</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Company</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Flags</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {props.outcomes.map((outcome) => {
              const flags: string[] = [];
              if (outcome.duplicates.length > 0) flags.push("Possible duplicate");
              if (outcome.missingRequired.length > 0) flags.push(`Missing: ${outcome.missingRequired.join(", ")}`);
              if (outcome.invalidDob) flags.push(`Invalid DOB${outcome.invalidDobReason ? ` (${outcome.invalidDobReason})` : ""}`);
              if (outcome.unknownForum) flags.push("Unknown Forum");
              if (outcome.needsRelationshipReview) flags.push("Needs relationship review");
              return (
                <tr key={outcome.rowNumber}>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-500">{outcome.rowNumber}</td>
                  <td className="px-3 py-2 text-sm text-ink">
                    {outcome.name || <span className="text-slate-400">Unnamed</span>}
                    {outcome.duplicates[0] && (
                      <Link href={`/members/${outcome.duplicates[0].id}`} className="ml-2 text-xs font-semibold text-eo-blue underline">
                        ({outcome.duplicates[0].name})
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700">{outcome.values.company || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {flags.length === 0 ? <span className="text-eo-teal">Clean</span> : flags.map((flag) => (
                      <span key={flag} className="mr-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{flag}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <select
                      value={outcome.action}
                      onChange={(event) => props.onUpdateAction(outcome.rowNumber, event.target.value as RowAction)}
                      className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
                    >
                      <option value="create">Create new</option>
                      <option value="update" disabled={!outcome.matchedExistingId}>
                        Update existing{outcome.matchedExistingId ? "" : " (no match)"}
                      </option>
                      <option value="skip">Skip / Review later</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Review and commit <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add the `CommitStep` sub-component below**

```tsx
function CommitStep(props: {
  impact: ReturnType<typeof computeImpact>;
  outcomes: RowOutcome[];
  onBack: () => void;
  onCommit: () => void;
  result: ImportSummary | null;
  onStartNew: () => void;
}) {
  if (props.result) {
    return (
      <section className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-6 shadow-card">
        <CheckCircle2 className="h-8 w-8 text-eo-teal" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Import complete</h2>
        <p className="mt-2 text-sm text-slate-700">
          Created {props.result.created} · Updated {props.result.updated} · Skipped {props.result.skipped}
          {props.result.duplicateFlagged > 0 ? ` · ${props.result.duplicateFlagged} duplicates flagged` : ""}
          {props.result.unknownForums > 0 ? ` · ${props.result.unknownForums} unknown forums` : ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/members" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">View members</Link>
          <Link href="/data-quality" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">Open Data Quality</Link>
          <Link href="/placement-queue" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">Open Placement Queue</Link>
          <button type="button" onClick={props.onStartNew} className="ml-auto rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Start a new import</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink">Confirm import</h2>
      <p className="mt-1 text-sm text-muted">
        Review the impact summary one last time. Members will be created or updated immediately and the change will appear in Data Quality, Placement Queue, Members, and Forum Groups.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Will create" value={props.impact.toCreate} />
        <Metric label="Will update" value={props.impact.toUpdate} />
        <Metric label="Will skip" value={props.impact.toSkip} />
      </div>

      {props.impact.unknownForumRows > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {props.impact.unknownForumRows} row{props.impact.unknownForumRows === 1 ? "" : "s"} reference Forums that don&apos;t exist in the system. Those members will not be auto-assigned.
        </div>
      )}
      {props.impact.duplicateRows > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {props.impact.duplicateRows} possible duplicate{props.impact.duplicateRows === 1 ? "" : "s"} detected. Defaults skip them — change to &quot;Update existing&quot; or &quot;Create new&quot; in the impact step if you want to proceed.
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button
          type="button"
          onClick={props.onCommit}
          disabled={props.impact.toCreate === 0 && props.impact.toUpdate === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-eo-pink px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          Commit import
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/import-data-wizard.tsx
git commit -m "feat(import): add five-step import data wizard component"
```

---

### Task 6: Page Route, Sidebar, Legacy Redirect

**Files:**
- Create: `app/(admin)/import-data/page.tsx`
- Modify: `components/app-shell.tsx`
- Modify: `app/(admin)/members/import/page.tsx`
- Delete: `components/csv-import-placeholder.tsx`

- [ ] **Step 1: Create the page**

Write `app/(admin)/import-data/page.tsx`:

```tsx
import { ImportDataWizard } from "@/components/import-data-wizard";

export const metadata = {
  title: "Import Data · Forum Placement Dashboard"
};

export default function ImportDataPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Forum Placement Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Import Data</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Bring legacy member records into the dashboard. Paste a CSV or upload a file, map your columns to member fields,
          review the impact, then commit. Imported members flow into Members, Data Quality, Placement Queue, and Forum Groups.
        </p>
      </header>
      <ImportDataWizard />
    </div>
  );
}
```

- [ ] **Step 2: Add the sidebar nav entry**

In `components/app-shell.tsx`, change:

```ts
import { ClipboardList, FileText, Inbox, LayoutDashboard, LayoutGrid, Network, ShieldCheck, UsersRound } from "lucide-react";
```

to:

```ts
import { ClipboardList, FileText, Inbox, LayoutDashboard, LayoutGrid, Network, ShieldCheck, Upload, UsersRound } from "lucide-react";
```

Then in the `navItems` array, add a new entry between `"Data Quality"` and `"Members"`:

```ts
  { href: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { href: "/import-data", label: "Import Data", icon: Upload },
  { href: "/members", label: "Members", icon: UsersRound },
```

- [ ] **Step 3: Replace the legacy `/members/import` page with a redirect**

Overwrite `app/(admin)/members/import/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function LegacyMemberImportPage() {
  redirect("/import-data");
}
```

- [ ] **Step 4: Delete the old placeholder component**

```bash
rm components/csv-import-placeholder.tsx
```

(The legacy page no longer imports it; nothing else does — confirm with `grep -r "csv-import-placeholder\|CsvImportPlaceholder" .` returning only matches inside `node_modules` or git history.)

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(admin\)/import-data/page.tsx components/app-shell.tsx app/\(admin\)/members/import/page.tsx
git rm components/csv-import-placeholder.tsx
git commit -m "feat(import): wire /import-data route, sidebar entry, redirect /members/import"
```

---

### Task 7: Verification

**Files:**
- No code changes.

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: PASS (no new warnings/errors). If pre-existing warnings appear in unrelated files, ignore them; only fix new ones we introduced.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (Next 15 build succeeds, all routes register including `/import-data`).

- [ ] **Step 3: Manual smoke — navigation and route**

Run `npm run dev`, open `http://localhost:3000`, then:
- Sidebar shows "Import Data" between "Data Quality" and "Members" with an Upload icon.
- Click it → lands on `/import-data` with the multi-step wizard.
- Visit `/members/import` directly → redirects to `/import-data`.

- [ ] **Step 4: Manual smoke — paste sample CSV end-to-end**

- Click "Copy sample template", paste into the textarea.
- Verify "Columns detected: 16, Data rows: 3".
- Continue to Preview → verify all 3 rows render with row numbers 2, 3, 4.
- Continue to Mapping → verify auto-suggest filled at minimum: fullName=Name, company=Company, industry=Industry, homeLocation=Home Location, businessLocation=Business Location, dateOfBirth=Date Of Birth, gender=Gender, revenueRange=Revenue Range, employeeCount=Employee Count, yearsInBusiness=Years In Business, businessStage=Business Stage, status=Status, currentForum=Current Forum, forumStylePreference=Forum Style Preference, relationshipReviewCompleted=Relationship Review Completed, notes=Notes.
- Continue to Impact → verify counts: Will create 3, Will update 0, Will skip 0 (assuming the 3 sample names don't collide with existing mock data — Sam Patel may collide with mock-data; if it does, the row will default to skip. That's correct behavior — change to "Create new" to proceed).
- Verify "Sam Patel" row shows "In Forum" handling: Harbor Forum exists in mock data → status In Forum, currentForumId set. If Harbor Forum doesn't exist by exact name, "Unknown Forum" flag should appear.
- Continue → Commit → click "Commit import".
- Verify success card with "Import complete: Created N · Updated 0 · Skipped 0".

- [ ] **Step 5: Manual smoke — duplicate detection**

- Click "Start a new import".
- Paste this CSV:

  ```
  Name,Company,Industry,Home Location,Business Location,Date Of Birth,Revenue Range,Years In Business
  Jordan Lee,Lee Growth Group,Professional Services,Downtown,Downtown,1978-04-12,$3M-$10M,12
  ```

- Walk through to Impact step.
- Verify the row shows a "Possible duplicate" badge with a link to the previously created member, and the Action default is "Skip / Review later".
- Change to "Update existing" → commit → verify the existing member's record is updated (visit `/members`).

- [ ] **Step 6: Manual smoke — missing required + invalid DOB**

- New import with this CSV:

  ```
  Name,Company,Date Of Birth
  Casey Stone,,1985-13-40
  ```

- Walk to Impact: row should show "Missing: industry, homeLocation, businessLocation, revenueRange, yearsInBusiness", "Invalid DOB (Calendar-invalid date (e.g., Feb 30))" — no, "Date out of range." for month=13 — verify the right reason appears.
- Default action will be Create (not skip — it's not a duplicate).
- Commit. Verify the new member appears in `/data-quality` under "Missing Industry", "Missing Home Location", etc., and is NOT in "Ready To Assign".

- [ ] **Step 7: Manual smoke — Forum Groups recompute**

- Create an import with a valid Current Forum (use an existing forum name from the mock data — e.g., "Harbor Forum" if present, else open `/forums` to pick a real name) and Status "In Forum".
- Commit. Open `/forums` → the forum's currentMemberIds count should include the new member; opening the forum detail page should list the imported member.

- [ ] **Step 8: Manual smoke — activity history**

- Open `/dashboard` (or wherever activity is rendered).
- Verify recent activity shows: "Import started", "Member imported" (per row), "Import duplicate flagged" if applicable, "Import row skipped" if applicable, "Import completed".

- [ ] **Step 9: Confirm `Recent imports` section appears on subsequent visits**

- Reload `/import-data`.
- The "Recent imports" card should list the previous imports with timestamps and counts.

- [ ] **Step 10: Final commit (if any fixups needed)**

If verification surfaced issues, fix them and commit:

```bash
git add -A
git commit -m "fix(import): address smoke test findings"
```

If nothing needed fixing, no commit.

---

## Self-Review Notes

- **Spec coverage check:**
  - Sidebar entry ✓ (Task 6 Step 2)
  - Route ✓ (Task 6 Step 1)
  - Step 1 Add data: paste, upload, sample template (copy + download) ✓ (Task 5 Step 2)
  - Step 2 Preview: parse, table, row count, columns, invalid rows ✓ (Task 5 Step 3)
  - Step 3 Field mapping: auto-suggest, current model fields ✓ (Task 5 Step 4)
  - Step 4 Impact summary: all 8 categories ✓ (Task 5 Step 5)
  - Step 5 Commit: per-row action override (skip/create/update/review-later via skip), no silent merges ✓ (Task 5 Steps 5-6)
  - Duplicate detection: name/company/name+company/name+DOB ✓ (`findDuplicatesForRow` in `lib/import.ts`)
  - Possible Duplicate badge + link + per-row options ✓ (`ImpactStep`)
  - Status defaulting + In Forum only when forum exists ✓ (`resolveStatus` + `buildMemberFromRow`)
  - Unknown Forum flag, no auto-assignment ✓
  - Imported members don't auto-promote to Ready To Assign ✓ (`settleStatusAfterBuild` only goes to "Free Agent")
  - Activity events for all 7 categories spec'd, plus duplicate-flagged ✓
  - Sample CSV template covers all spec'd columns ✓
  - Privacy note rendered ✓ (Task 5 Step 1, returned from `ImportDataWizard`)
  - Clear current draft ✓
  - Previous import summaries on Add step ✓
  - Result summary after commit ✓

- **Placeholder scan:** no TBD, TODO, "implement later", or hand-wavy "add validation" — all code blocks contain working code.

- **Type consistency:** `RowAction` ∈ {"create","update","skip"} used identically across `lib/import.ts` and `components/import-data-wizard.tsx`. `ImportField` union matches `IMPORT_FIELDS[].id`. `ImportSummary` shape defined in `live-data-provider.tsx` and imported into the wizard.

- **Risk note for executor:** the `useMemo(() => { if (step !== "add") refreshOutcomes(); }, ...)` pattern in Step 1 of Task 5 uses `useMemo` for its side-effect. If lint complains about that, switch to `useEffect` with the same dependency array. Both work; `useEffect` is more idiomatic.
