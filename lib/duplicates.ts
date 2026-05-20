import type { DuplicateCase, DuplicateConfidence, DuplicateSource, Member } from "./types";

const normalise = (value?: string) => (value ?? "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

const nameParts = (name?: string) => normalise(name).split(" ").filter(Boolean);

const similarName = (a?: string, b?: string) => {
  const left = nameParts(a);
  const right = nameParts(b);
  if (left.length === 0 || right.length === 0) return false;
  const shared = left.filter((part) => right.includes(part)).length;
  if (shared >= Math.min(left.length, right.length)) return true;
  return left[0] === right[0] && left[left.length - 1]?.[0] === right[right.length - 1]?.[0];
};

export const duplicatePairKey = (aId: string, bId: string) => [aId, bId].sort().join("__");

export const duplicateCaseId = (source: DuplicateSource, aId: string, bId: string) =>
  `dup-${source.toLowerCase()}-${duplicatePairKey(aId, bId)}`;

export const analyzeDuplicateMatch = (a: Pick<Member, "id" | "name" | "company" | "dateOfBirth">, b: Pick<Member, "id" | "name" | "company" | "dateOfBirth">) => {
  const sameName = normalise(a.name) !== "" && normalise(a.name) === normalise(b.name);
  const namesSimilar = !sameName && similarName(a.name, b.name);
  const sameCompany = normalise(a.company) !== "" && normalise(a.company) === normalise(b.company);
  const sameDob = Boolean(a.dateOfBirth && b.dateOfBirth && a.dateOfBirth === b.dateOfBirth);
  const reasons: string[] = [];

  if (sameName && sameCompany) reasons.push("Same name + company");
  else if (sameName) reasons.push("Same or similar name");
  if (sameName && sameDob) reasons.push("Same name + DOB");
  if (sameCompany && namesSimilar) reasons.push("Same company + similar name");
  else if (sameCompany && !sameName) reasons.push("Same company");
  if (namesSimilar && !sameCompany) reasons.push("Same or similar name");

  let confidence: DuplicateConfidence = "Weak Match";
  if (reasons.includes("Same name + company") || reasons.includes("Same name + DOB") || reasons.includes("Same company + similar name")) {
    confidence = "Likely Duplicate";
  } else if (sameName || sameCompany) {
    confidence = "Possible Duplicate";
  }

  return { confidence, reasons: Array.from(new Set(reasons)) };
};

export const isDuplicateCandidate = (a: Pick<Member, "id" | "name" | "company" | "dateOfBirth">, b: Pick<Member, "id" | "name" | "company" | "dateOfBirth">) =>
  a.id !== b.id && analyzeDuplicateMatch(a, b).reasons.length > 0;

export const buildDuplicateCase = ({
  memberAId,
  memberB,
  source,
  createdAt = new Date().toISOString(),
  rowNumber,
  rowName,
  importSummaryId
}: {
  memberAId: string;
  memberB: Member;
  source: DuplicateSource;
  createdAt?: string;
  rowNumber?: number;
  rowName?: string;
  importSummaryId?: string;
}): DuplicateCase => {
  const { confidence, reasons } = analyzeDuplicateMatch({ id: memberAId, name: "", company: "" }, memberB);
  return {
    id: duplicateCaseId(source, memberAId, memberB.id),
    memberAId,
    memberBId: memberB.id,
    source,
    confidence,
    reasons,
    status: "Unresolved",
    createdAt,
    updatedAt: createdAt,
    rowNumber,
    rowName,
    importSummaryId
  };
};

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "" && value !== 0;

export const chooseDefaultValue = <T,>(a: T, b: T, aUpdated?: string, bUpdated?: string): T => {
  const aHas = hasValue(a);
  const bHas = hasValue(b);
  if (aHas && !bHas) return a;
  if (!aHas && bHas) return b;
  if (!aHas && !bHas) return a;
  const aTime = aUpdated ? new Date(aUpdated).getTime() : 0;
  const bTime = bUpdated ? new Date(bUpdated).getTime() : 0;
  return bTime > aTime ? b : a;
};
