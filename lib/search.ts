import type { ForumGroup, Member, MemberStatus } from "./types";

export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const editDistance = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

export const simpleSimilarity = (a: string, b: string) => {
  const left = normalizeSearchText(a);
  const right = normalizeSearchText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (right.includes(left) || left.includes(right)) return 0.92;

  const leftTokens = left.split(" ");
  const rightTokens = right.split(" ");
  const wholeScore = 1 - editDistance(left, right) / Math.max(left.length, right.length);
  const tokenScore = Math.max(
    ...leftTokens.flatMap((leftToken) =>
      rightTokens.map((rightToken) => 1 - editDistance(leftToken, rightToken) / Math.max(leftToken.length, rightToken.length))
    )
  );

  return Math.max(wholeScore, tokenScore);
};

export const getSearchableTerms = ({
  members = [],
  forums = [],
  statuses = []
}: {
  members?: Member[];
  forums?: ForumGroup[];
  statuses?: MemberStatus[] | string[];
}) => {
  const terms = new Set<string>();
  for (const member of members) {
    [member.name, member.company, member.industry, member.homeLocation, member.businessLocation, member.revenueRange, member.status].forEach((value) => {
      if (value) terms.add(value);
    });
  }
  for (const forum of forums) {
    [forum.name, forum.mainLocationZone, forum.forumStyle].forEach((value) => {
      if (value) terms.add(value);
    });
  }
  statuses.forEach((status) => terms.add(status));
  return Array.from(terms);
};

export const getFuzzySuggestions = (query: string, terms: string[], limit = 3) => {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  const seen = new Set<string>();
  return terms
    .map((term) => ({ term, normalized: normalizeSearchText(term) }))
    .filter(({ term, normalized }) => {
      if (!term || !normalized || normalized === normalizedQuery) return false;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map(({ term }) => ({ term, score: simpleSimilarity(normalizedQuery, term) }))
    .filter(({ score }) => score >= 0.58)
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, limit)
    .map(({ term }) => term);
};

export const matchesSearch = (query: string, values: Array<string | number | undefined | null>) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchText(String(value ?? "")).includes(normalizedQuery));
};
