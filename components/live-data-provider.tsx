"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoDataAdapter } from "@/lib/data-adapters";
import { buildForumsFromMembers } from "@/lib/matching";
import { analyzeDuplicateMatch, duplicateCaseId, isDuplicateCandidate } from "@/lib/duplicates";
import { localPlacementStorageKey, localPlacementUpdatedEvent, parseLocalPlacementDecisions, type LocalPlacementDecision } from "@/lib/local-placements";
import { ASSIGNMENT_WINDOW_DAYS, computeAssignmentExpiration, getEffectiveStatus } from "@/lib/assignments";
import {
  computeDataQualityLabels,
  daysSinceUpdate,
  hasMissingRequiredFields,
  isStaleRecord,
  meetsRequiredFields,
  missingRequiredFields
} from "@/lib/data-quality";
import type {
  ActivityEvent,
  BusinessStage,
  DataQualityLabel,
  DecisionReason,
  DuplicateCase,
  DuplicateSource,
  DuplicateStatus,
  ForumGroup,
  ForumStyle,
  Gender,
  IntakeDisclosures,
  Member,
  MemberRelationship,
  MemberStatus,
  PlacementDecision,
  RelationshipSeverity,
  RelationshipType
} from "@/lib/types";

const demoSeed = demoDataAdapter.loadSeed();
const baseActivity = demoSeed.activity;
const baseForums = demoSeed.forums;
const baseRelationships = demoSeed.relationships;
const baseMembers = demoSeed.members;
const basePlacements = demoSeed.placementDecisions;

export const liveMembersKey = "forumflow.live.members";
export const liveRelationshipsKey = "forumflow.live.relationships";
export const liveActivityKey = "forumflow.live.activity";
const liveDataUpdatedEvent = "forumflow.live.updated";
export const liveImportSummariesKey = "forumflow.live.import-summaries";
export const liveDuplicateCasesKey = "forumflow.live.duplicate-cases";
export const liveDemoToolsKey = "forumflow.live.demo-tools";

export const memberStatuses: MemberStatus[] = [
  "New Member",
  "Free Agent",
  "Needs Info",
  "Needs Conflict Review",
  "Ready To Assign",
  "Shortlisted",
  "Assigned / Pending Forum Review",
  "In Forum",
  "Rejected",
  "Assignment Expired",
  "Pending Approval",
  "Placed",
  "On Hold",
  "Former Member"
];
export const genders: Gender[] = ["Woman", "Man"];
export const businessStages: BusinessStage[] = ["Startup", "Growth", "Scaling", "Mature", "Transition"];
export const forumStyles: ForumStyle[] = ["Business-focused", "Balanced", "Personal/deeper discussion", "Social/travel-heavy"];
export const revenueRanges = ["$1M-$3M", "$3M-$10M", "$10M-$25M", "$25M+"];

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

export type DuplicateMergePayload = {
  caseId: string;
  primaryId: string;
  finalMember: Member;
  note?: string;
};

export type DemoToolsMetadata = {
  lastResetAt?: string;
  lastClearedAt?: string;
  lastExportAt?: string;
  lastImportAt?: string;
};

export type LocalDataBackup = {
  exportedAt: string;
  members: Member[];
  relationships: MemberRelationship[];
  activity: ActivityEvent[];
  placements: LocalPlacementDecision[];
  importSummaries: ImportSummary[];
  duplicateCases: DuplicateCase[];
  demoTools?: DemoToolsMetadata;
};

export const relationshipTypes: RelationshipType[] = [
  "Blood relative",
  "Spouse",
  "Current business partner",
  "Former business partner",
  "Prior business relationship",
  "Direct competitor",
  "Close friend",
  "Personal conflict",
  "Other"
];
export const relationshipSeverities: RelationshipSeverity[] = ["Blocked", "Needs Review", "Note Only"];

export const decisionReasons: DecisionReason[] = [
  "Industry Conflict",
  "Relationship Conflict",
  "Better Fit Elsewhere",
  "Location Mismatch",
  "Business Stage Mismatch",
  "Waiting On Info",
  "Approved By Placement Chair",
  "Forum Accepted",
  "Forum Rejected",
  "Assignment Expired",
  "Other"
];

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(liveDataUpdatedEvent));
};

const activityId = () => `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const unique = <T,>(values: T[]) => Array.from(new Set(values.filter(Boolean)));

const mergeText = (labelA: string, textA?: string, labelB?: string, textB?: string) => {
  const parts: string[] = [];
  if (textA?.trim()) parts.push(`[${labelA}] ${textA.trim()}`);
  if (textB?.trim()) parts.push(`[${labelB ?? "Merged record"}] ${textB.trim()}`);
  return parts.join("\n\n");
};

const mergeDisclosures = (a?: IntakeDisclosures, b?: IntakeDisclosures): IntakeDisclosures | undefined => {
  if (!a && !b) return undefined;
  const fields: (keyof IntakeDisclosures)[] = [
    "bloodRelatives",
    "spouse",
    "currentBusinessPartners",
    "formerBusinessPartners",
    "priorBusinessRelationships",
    "directCompetitors",
    "closeFriends",
    "otherNotes"
  ];
  const merged: IntakeDisclosures = {};
  for (const field of fields) {
    const value = mergeText("Primary", a?.[field], "Merged duplicate", b?.[field]);
    if (value) merged[field] = value;
  }
  return merged;
};

const combineMemberArrays = (a: string[] = [], b: string[] = [], survivorId: string, mergedId: string) =>
  unique([...a, ...b].map((id) => id === mergedId ? survivorId : id).filter((id) => id !== survivorId && id !== mergedId));

const relationshipRank: Record<RelationshipSeverity, number> = { "Note Only": 1, "Needs Review": 2, Blocked: 3 };

const reassignRelationships = (relationships: MemberRelationship[], survivorId: string, mergedId: string) => {
  const byKey = new Map<string, MemberRelationship>();
  for (const relationship of relationships) {
    const memberId = relationship.memberId === mergedId ? survivorId : relationship.memberId;
    const relatedMemberId = relationship.relatedMemberId === mergedId ? survivorId : relationship.relatedMemberId;
    if (memberId === relatedMemberId) continue;
    const pair = [memberId, relatedMemberId].sort().join("__");
    const key = `${pair}__${relationship.type}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...relationship, id: relationship.id.startsWith("rel-local-") ? relationship.id : `rel-local-${relationship.id}`, memberId, relatedMemberId });
      continue;
    }
    byKey.set(key, {
      ...existing,
      severity: relationshipRank[relationship.severity] > relationshipRank[existing.severity] ? relationship.severity : existing.severity,
      notes: unique([existing.notes, relationship.notes]).filter(Boolean).join(" / ")
    });
  }
  return Array.from(byKey.values());
};

export const getMemberDataQuality = (member: Member, relationships: MemberRelationship[]): DataQualityLabel[] =>
  computeDataQualityLabels(member, relationships);

export const isMemberReadyToAssign = meetsRequiredFields;

const mergeMembers = (localMembers: Member[]) => {
  const localById = new Map(localMembers.map((member) => [member.id, member]));
  const merged = baseMembers.map((member) => localById.get(member.id) ?? member);
  const baseIds = new Set(baseMembers.map((member) => member.id));
  return [...merged, ...localMembers.filter((member) => !baseIds.has(member.id))];
};

const normalizeStatusForPlacement = (member: Member): Member => {
  // If a member has a confirmed forum, keep In Forum.
  if (member.currentForumId && member.status !== "In Forum" && member.status !== "Placed") {
    // Members assigned to currentForumId in seed mock data should show as "In Forum".
    if (!member.assignedForumId) {
      return { ...member, status: "In Forum" };
    }
  }
  return member;
};

const normalizeDuplicateText = (value?: string) => (value ?? "").trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

const duplicateCandidatePairKeys = (members: Member[]) => {
  const buckets = new Map<string, Member[]>();
  const add = (key: string, member: Member) => {
    if (!key) return;
    const existing = buckets.get(key);
    if (existing) existing.push(member);
    else buckets.set(key, [member]);
  };

  for (const member of members) {
    const name = normalizeDuplicateText(member.name);
    const company = normalizeDuplicateText(member.company);
    const parts = name.split(" ").filter(Boolean);
    const first = parts[0] ?? "";
    const lastInitial = parts[parts.length - 1]?.[0] ?? "";
    add(`name:${name}`, member);
    add(`company:${company}`, member);
    add(`initial:${first}:${lastInitial}`, member);
    if (member.dateOfBirth && first) add(`dob:${member.dateOfBirth}:${first}`, member);
  }

  const pairKeys = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        pairKeys.add([bucket[i].id, bucket[j].id].sort().join("__"));
      }
    }
  }
  return pairKeys;
};

function useLiveDataValue() {
  const [localMembers, setLocalMembers] = useState<Member[]>([]);
  const [localRelationships, setLocalRelationships] = useState<MemberRelationship[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [localPlacements, setLocalPlacements] = useState<LocalPlacementDecision[]>([]);
  const [importSummaries, setImportSummaries] = useState<ImportSummary[]>([]);
  const [storedDuplicateCases, setStoredDuplicateCases] = useState<DuplicateCase[]>([]);
  const [demoTools, setDemoTools] = useState<DemoToolsMetadata>({});

  const reload = useCallback(() => {
    setLocalMembers(readJson<Member[]>(liveMembersKey, []));
    setLocalRelationships(readJson<MemberRelationship[]>(liveRelationshipsKey, []));
    setActivity(readJson<ActivityEvent[]>(liveActivityKey, []));
    setLocalPlacements(parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)));
    setImportSummaries(readJson<ImportSummary[]>(liveImportSummariesKey, []));
    setStoredDuplicateCases(readJson<DuplicateCase[]>(liveDuplicateCasesKey, []));
    setDemoTools(readJson<DemoToolsMetadata>(liveDemoToolsKey, {}));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(liveDataUpdatedEvent, reload);
    window.addEventListener(localPlacementUpdatedEvent, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(liveDataUpdatedEvent, reload);
      window.removeEventListener(localPlacementUpdatedEvent, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const members = useMemo(() => mergeMembers(localMembers).map(normalizeStatusForPlacement), [localMembers]);
  const forums = useMemo(() => buildForumsFromMembers(baseForums, members), [members]);
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const forumsById = useMemo(() => new Map(forums.map((forum) => [forum.id, forum])), [forums]);
  const mergedActivity = useMemo(() => [...activity, ...baseActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 220), [activity]);
  const relationships = useMemo(() => {
    const localIds = new Set(localRelationships.map((relationship) => relationship.id));
    return [...baseRelationships.filter((relationship) => !localIds.has(relationship.id)), ...localRelationships];
  }, [localRelationships]);
  const relationshipsByMemberId = useMemo(() => {
    const byMember = new Map<string, MemberRelationship[]>();
    for (const relationship of relationships) {
      const left = byMember.get(relationship.memberId) ?? [];
      left.push(relationship);
      byMember.set(relationship.memberId, left);
      const right = byMember.get(relationship.relatedMemberId) ?? [];
      right.push(relationship);
      byMember.set(relationship.relatedMemberId, right);
    }
    return byMember;
  }, [relationships]);

  const placements: PlacementDecision[] = useMemo(() => [
    ...basePlacements,
    ...localPlacements.map((placement, index) => {
      const status: PlacementDecision["status"] =
        placement.status === "Confirmed" ? "Approved" :
        placement.status === "Returned" ? "Rejected" :
        placement.status === "Assigned" ? "Approved" :
        placement.status === "Approved" ? "Approved" :
        placement.status === "Placed" ? "Placed" :
        placement.status === "Rejected" ? "Rejected" :
        placement.status === "Shortlisted" ? "Shortlisted" :
        "Needs Review";
      return {
        id: `local-${index}-${placement.memberId}`,
        memberId: placement.memberId,
        forumId: placement.forumId,
        status,
        reason: placement.reason || placement.note || "Saved local placement decision."
      } satisfies PlacementDecision;
    })
  ], [localPlacements]);

  const duplicateCases = useMemo(() => {
    const activeMembers = members.filter((member) => member.status !== "Former Member");
    const storedById = new Map(storedDuplicateCases.map((duplicate) => [duplicate.id, duplicate]));
    const memberById = new Map(activeMembers.map((member) => [member.id, member]));
    const cases: DuplicateCase[] = [];

    for (const pairKey of duplicateCandidatePairKeys(activeMembers)) {
      const [leftId, rightId] = pairKey.split("__");
      const a = memberById.get(leftId);
      const b = memberById.get(rightId);
      if (!a || !b || !isDuplicateCandidate(a, b)) continue;
      const match = analyzeDuplicateMatch(a, b);
      if (match.confidence !== "Likely Duplicate") continue;
      const id = duplicateCaseId("Manual", a.id, b.id);
      const stored = storedById.get(id);
      if (stored?.status === "Not Duplicate" || stored?.status === "Merged" || stored?.status === "Archived") continue;
      cases.push(stored ?? {
        id,
        memberAId: a.id,
        memberBId: b.id,
        source: "Manual",
        confidence: match.confidence,
        reasons: match.reasons,
        status: "Unresolved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    for (const stored of storedDuplicateCases) {
      if (!cases.some((item) => item.id === stored.id)) cases.push(stored);
    }

    return cases.sort((a, b) => {
      const rank: Record<DuplicateCase["status"], number> = { Unresolved: 0, Skipped: 1, "Not Duplicate": 2, Merged: 3, Archived: 4 };
      return rank[a.status] - rank[b.status] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [members, storedDuplicateCases]);

  const openDuplicateMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const duplicate of duplicateCases) {
      if (duplicate.status === "Not Duplicate" || duplicate.status === "Merged" || duplicate.status === "Archived") continue;
      ids.add(duplicate.memberAId);
      if (duplicate.memberBId) ids.add(duplicate.memberBId);
    }
    return ids;
  }, [duplicateCases]);

  const duplicateCasesByMemberId = useMemo(() => {
    const byMember = new Map<string, DuplicateCase[]>();
    for (const duplicate of duplicateCases) {
      if (duplicate.status === "Not Duplicate" || duplicate.status === "Merged" || duplicate.status === "Archived") continue;
      const left = byMember.get(duplicate.memberAId) ?? [];
      left.push(duplicate);
      byMember.set(duplicate.memberAId, left);
      if (duplicate.memberBId) {
        const right = byMember.get(duplicate.memberBId) ?? [];
        right.push(duplicate);
        byMember.set(duplicate.memberBId, right);
      }
    }
    return byMember;
  }, [duplicateCases]);

  const persistMembers = useCallback((nextMembers: Member[]) => {
    const baseIds = new Set(baseMembers.map((member) => member.id));
    const changed = nextMembers.filter((member) => {
      const base = baseMembers.find((item) => item.id === member.id);
      return !baseIds.has(member.id) || JSON.stringify(base) !== JSON.stringify(member);
    });
    writeJson(liveMembersKey, changed);
  }, []);

  const addActivity = useCallback((event: Omit<ActivityEvent, "id" | "createdAt">) => {
    const next = [{ ...event, id: activityId(), createdAt: new Date().toISOString() }, ...readJson<ActivityEvent[]>(liveActivityKey, [])].slice(0, 120);
    writeJson(liveActivityKey, next);
  }, []);

  const saveMember = useCallback((member: Member, activityType: ActivityEvent["type"] = "Member edited", detail?: string) => {
    const stamped: Member = { ...member, updatedAt: new Date().toISOString() };
    const nextMembers = mergeMembers(readJson<Member[]>(liveMembersKey, [])).map((item) => item.id === stamped.id ? stamped : item);
    if (!nextMembers.some((item) => item.id === stamped.id)) nextMembers.unshift(stamped);
    persistMembers(nextMembers);
    member = stamped;
    addActivity({
      type: activityType,
      memberId: member.id,
      memberName: member.name,
      forumId: member.currentForumId ?? member.assignedForumId,
      forumName: forumsById.get(member.currentForumId ?? member.assignedForumId ?? "")?.name,
      detail: detail ?? `${member.name} ${activityType === "Member added" ? "was added" : "was updated"}.`
    });
  }, [addActivity, forumsById, persistMembers]);

  const addMember = useCallback((member: Omit<Member, "id">) => {
    const id = `mem-local-${Date.now()}`;
    const nextMember: Member = { ...member, id };
    saveMember(nextMember, "Member added");
    return nextMember;
  }, [saveMember]);

  const saveRelationship = useCallback((relationship: Omit<MemberRelationship, "id"> & { id?: string }) => {
    const id = relationship.id ?? `rel-local-${Date.now()}`;
    const nextRelationship: MemberRelationship = { ...relationship, id };
    const existing = readJson<MemberRelationship[]>(liveRelationshipsKey, []);
    writeJson(liveRelationshipsKey, [nextRelationship, ...existing.filter((item) => item.id !== id)]);
    const member = membersById.get(relationship.memberId);
    addActivity({
      type: "Conflict added",
      memberId: relationship.memberId,
      memberName: member?.name,
      detail: `${relationship.type} relationship recorded as ${relationship.severity}.`
    });
  }, [addActivity, membersById]);

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

  const persistDuplicateCases = useCallback((nextCases: DuplicateCase[]) => {
    writeJson(liveDuplicateCasesKey, nextCases);
  }, []);

  const recordDuplicateCase = useCallback((input: {
    memberA: Member;
    memberB?: Member;
    draftMember?: Member;
    source: DuplicateSource;
    rowNumber?: number;
    rowName?: string;
    importSummaryId?: string;
  }) => {
    const candidate = input.memberB ?? input.draftMember;
    if (!candidate) return;
    const now = new Date().toISOString();
    const match = analyzeDuplicateMatch(input.memberA, candidate);
    if (match.reasons.length === 0) return;
    const id = input.memberB
      ? duplicateCaseId(input.source, input.memberA.id, input.memberB.id)
      : `dup-import-draft-${input.memberA.id}-${input.rowNumber ?? Date.now()}-${candidate.id}`;
    const existing = readJson<DuplicateCase[]>(liveDuplicateCasesKey, []);
    const nextCase: DuplicateCase = {
      id,
      memberAId: input.memberA.id,
      memberBId: input.memberB?.id,
      draftMember: input.draftMember,
      source: input.source,
      confidence: match.confidence,
      reasons: match.reasons,
      status: existing.find((item) => item.id === id)?.status ?? "Unresolved",
      createdAt: existing.find((item) => item.id === id)?.createdAt ?? now,
      updatedAt: now,
      rowNumber: input.rowNumber,
      rowName: input.rowName,
      importSummaryId: input.importSummaryId
    };
    persistDuplicateCases([nextCase, ...existing.filter((item) => item.id !== id)]);
    addActivity({
      type: input.source === "Import" ? "Import duplicate flagged" : "Possible duplicate flagged",
      memberId: input.memberA.id,
      memberName: input.memberA.name,
      detail: `${input.source} duplicate review opened for ${input.memberA.name} and ${candidate.name}.`
    });
  }, [addActivity, persistDuplicateCases]);

  const updateDuplicateCaseStatus = useCallback((caseId: string, status: DuplicateStatus, detailType: ActivityEvent["type"], note?: string) => {
    const existing = readJson<DuplicateCase[]>(liveDuplicateCasesKey, []);
    const now = new Date().toISOString();
    const target = duplicateCases.find((item) => item.id === caseId) ?? existing.find((item) => item.id === caseId);
    if (!target) return;
    const nextTarget: DuplicateCase = { ...target, status, note, updatedAt: now, resolvedAt: status === "Skipped" ? undefined : now };
    persistDuplicateCases([nextTarget, ...existing.filter((item) => item.id !== caseId)]);
    const memberA = membersById.get(target.memberAId);
    const memberB = target.memberBId ? membersById.get(target.memberBId) : target.draftMember;
    addActivity({
      type: detailType,
      memberId: memberA?.id,
      memberName: memberA?.name,
      detail: `${memberA?.name ?? target.memberAId} and ${memberB?.name ?? "import draft"} marked ${status}.${note ? ` ${note}` : ""}`
    });
  }, [addActivity, duplicateCases, membersById, persistDuplicateCases]);

  const recordLocalDecision = useCallback((decision: LocalPlacementDecision) => {
    const existing = parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey));
    const next = [decision, ...existing.filter((item) => !(item.memberId === decision.memberId && item.forumId === decision.forumId && item.status === decision.status))].slice(0, 80);
    window.localStorage.setItem(localPlacementStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));
  }, []);

  // Legacy: kept for compatibility with old MatchDecisionButtons + PlacementActions code paths.
  const recordPlacementDecision = useCallback(({
    member,
    forum,
    status,
    note = ""
  }: {
    member: Member;
    forum: ForumGroup;
    status: LocalPlacementDecision["status"];
    note?: string;
  }) => {
    const decision: LocalPlacementDecision = {
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status,
      note,
      createdAt: new Date().toISOString()
    };
    recordLocalDecision(decision);

    if (status === "Shortlisted") {
      saveMember({ ...member, status: "Shortlisted" }, "Match shortlisted", `${member.name} shortlisted for ${forum.name}.`);
    } else if (status === "Needs Review") {
      saveMember({ ...member, status: "Needs Conflict Review" }, "Needs review", `${member.name} flagged for review against ${forum.name}.`);
    } else if (status === "Rejected") {
      addActivity({
        type: "Match rejected",
        memberId: member.id,
        memberName: member.name,
        forumId: forum.id,
        forumName: forum.name,
        detail: `${member.name} was rejected for ${forum.name}.${note ? ` ${note}` : ""}`
      });
    }
  }, [addActivity, recordLocalDecision, saveMember]);

  const assignToForum = useCallback(({
    member,
    forum,
    note = "",
    reason
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
    reason?: DecisionReason;
  }) => {
    const startDate = new Date().toISOString();
    const expiresAt = computeAssignmentExpiration(startDate);
    const nextMember: Member = {
      ...member,
      status: "Assigned / Pending Forum Review",
      assignedForumId: forum.id,
      assignmentStartDate: startDate,
      assignmentExpiresAt: expiresAt
    };
    saveMember(
      nextMember,
      "Member assigned to Forum",
      `${member.name} assigned to ${forum.name}. ${ASSIGNMENT_WINDOW_DAYS}-day Forum review window started.${note ? ` Note: ${note}` : ""}`
    );
    recordLocalDecision({
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status: "Assigned",
      note,
      reason,
      createdAt: startDate
    });
  }, [recordLocalDecision, saveMember]);

  const confirmInForum = useCallback(({
    member,
    forum,
    note = "",
    reason
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
    reason?: DecisionReason;
  }) => {
    const nextMember: Member = {
      ...member,
      status: "In Forum",
      currentForumId: forum.id,
      assignedForumId: undefined,
      assignmentStartDate: undefined,
      assignmentExpiresAt: undefined
    };
    saveMember(nextMember, "Forum confirmed member", `${forum.name} confirmed ${member.name} as a Forum member.${note ? ` Note: ${note}` : ""}`);
    recordLocalDecision({
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status: "Confirmed",
      note,
      reason: reason ?? "Forum Accepted",
      createdAt: new Date().toISOString()
    });
  }, [recordLocalDecision, saveMember]);

  const rejectAssignment = useCallback(({
    member,
    forum,
    note = "",
    reason
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
    reason?: DecisionReason;
  }) => {
    const rejectedForumIds = Array.from(new Set([...(member.rejectedForumIds ?? []), forum.id]));
    const nextMember: Member = {
      ...member,
      status: "Free Agent",
      assignedForumId: undefined,
      assignmentStartDate: undefined,
      assignmentExpiresAt: undefined,
      rejectedForumIds
    };
    saveMember(nextMember, "Forum rejected member", `${forum.name} rejected ${member.name}.${reason ? ` Reason: ${reason}.` : ""}${note ? ` ${note}` : ""}`);
    recordLocalDecision({
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status: "Rejected",
      note,
      reason: reason ?? "Forum Rejected",
      createdAt: new Date().toISOString()
    });
  }, [recordLocalDecision, saveMember]);

  const returnToFreeAgent = useCallback(({
    member,
    note = "",
    reason
  }: {
    member: Member;
    note?: string;
    reason?: DecisionReason;
  }) => {
    const nextMember: Member = {
      ...member,
      status: "Free Agent",
      assignedForumId: undefined,
      assignmentStartDate: undefined,
      assignmentExpiresAt: undefined
    };
    saveMember(nextMember, "Member returned to Free Agent", `${member.name} returned to Free Agent pool.${reason ? ` Reason: ${reason}.` : ""}${note ? ` ${note}` : ""}`);
  }, [saveMember]);

  const markAssignmentExpired = useCallback(({
    member,
    forum
  }: {
    member: Member;
    forum?: ForumGroup;
  }) => {
    const nextMember: Member = {
      ...member,
      status: "Assignment Expired"
    };
    saveMember(nextMember, "Assignment expired", `${member.name}'s ${ASSIGNMENT_WINDOW_DAYS}-day assignment review window expired${forum ? ` (assigned to ${forum.name})` : ""}.`);
  }, [saveMember]);

  const updateMemberStatus = useCallback(({
    member,
    status,
    note
  }: {
    member: Member;
    status: MemberStatus;
    note?: string;
  }) => {
    const nextMember: Member = { ...member, status };
    saveMember(nextMember, "Status changed", `${member.name} status changed to ${status}.${note ? ` ${note}` : ""}`);
  }, [saveMember]);

  const findPossibleDuplicates = useCallback((draft: { name?: string; company?: string; dateOfBirth?: string; excludeId?: string }) => {
    if (!draft.name && !draft.company && !draft.dateOfBirth) return [] as Member[];
    return members.filter((existing) => {
      if (draft.excludeId && existing.id === draft.excludeId) return false;
      if (existing.status === "Former Member") return false;
      return isDuplicateCandidate(
        existing,
        { id: draft.excludeId ?? "draft", name: draft.name ?? "", company: draft.company ?? "", dateOfBirth: draft.dateOfBirth }
      );
    }).slice(0, 4);
  }, [members]);

  const submitIntake = useCallback((submission: {
    firstName: string;
    lastName: string;
    company: string;
    industry: string;
    dateOfBirth?: string;
    gender: Gender;
    homeLocation: string;
    businessLocation: string;
    revenueRange: string;
    employeeCount: number;
    yearsInBusiness: number;
    businessStage: BusinessStage;
    forumStylePreference: ForumStyle;
    currentForumStatusNote?: string;
    disclosures?: IntakeDisclosures;
  }) => {
    const fullName = `${submission.firstName.trim()} ${submission.lastName.trim()}`.trim();
    const id = `mem-intake-${Date.now()}`;
    const submittedAt = new Date().toISOString();

    const calcAgeFromDob = (dob?: string) => {
      if (!dob) return 0;
      const date = new Date(dob);
      if (Number.isNaN(date.getTime())) return 0;
      const now = new Date();
      let years = now.getUTCFullYear() - date.getUTCFullYear();
      const monthDiff = now.getUTCMonth() - date.getUTCMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < date.getUTCDate())) years -= 1;
      return Math.max(0, years);
    };
    const age = calcAgeFromDob(submission.dateOfBirth);
    const ageRange = age >= 60 ? "60+" : age >= 50 ? "50-59" : age >= 40 ? "40-49" : "30-39";

    const baseNotes = submission.disclosures?.otherNotes?.trim();
    const forumStatusNote = submission.currentForumStatusNote?.trim();
    const combinedNotes = [baseNotes, forumStatusNote ? `Current Forum status: ${forumStatusNote}` : null].filter(Boolean).join("\n");
    const hasRelationshipDisclosures = Object.values(submission.disclosures ?? {}).some((value) => Boolean(value?.trim()));

    const member: Member = {
      id,
      name: fullName || "Unknown intake",
      company: submission.company.trim(),
      industry: submission.industry.trim(),
      businessLocation: submission.businessLocation.trim(),
      homeLocation: submission.homeLocation.trim(),
      gender: submission.gender,
      age,
      ageRange,
      dateOfBirth: submission.dateOfBirth || undefined,
      revenueRange: submission.revenueRange,
      employeeCount: submission.employeeCount,
      yearsInBusiness: submission.yearsInBusiness,
      businessStage: submission.businessStage,
      status: "New Member",
      forumStylePreference: submission.forumStylePreference,
      knownRelatives: [],
      spouseInChapter: [],
      businessPartners: [],
      previousBusinessRelationships: [],
      hardConflictMemberIds: [],
      directCompetitors: [],
      closeFriends: [],
      notes: combinedNotes,
      currentForumId: undefined,
      assignedForumId: undefined,
      assignmentStartDate: undefined,
      assignmentExpiresAt: undefined,
      rejectedForumIds: [],
      updatedAt: submittedAt,
      relationshipReviewCompleted: !hasRelationshipDisclosures,
      relationshipReviewedAt: hasRelationshipDisclosures ? undefined : submittedAt,
      intakeSubmittedAt: submittedAt,
      intakeDisclosures: submission.disclosures
    };

    saveMember(member, "Intake submitted", `${member.name} submitted an intake form (${member.company || "no company"}).`);

    // Run duplicate detection at intake time and emit a flagged event.
    const duplicates = findPossibleDuplicates({ name: member.name, company: member.company, dateOfBirth: member.dateOfBirth, excludeId: member.id });
    if (duplicates.length > 0) {
      duplicates.forEach((duplicate) => recordDuplicateCase({ memberA: duplicate, memberB: member, source: "Intake" }));
    }

    return { member, duplicates };
  }, [findPossibleDuplicates, recordDuplicateCase, saveMember]);

  const markIntakeReviewed = useCallback(({ member, note }: { member: Member; note?: string }) => {
    addActivity({
      type: "Intake reviewed",
      memberId: member.id,
      memberName: member.name,
      detail: `Intake submission for ${member.name} reviewed.${note ? ` ${note}` : ""}`
    });
  }, [addActivity]);

  const archiveIntake = useCallback(({ member, note, reason }: { member: Member; note?: string; reason?: DecisionReason }) => {
    const nextMember: Member = { ...member, status: "Former Member" };
    saveMember(nextMember, "Archived intake", `Archived intake submission for ${member.name}.${reason ? ` Reason: ${reason}.` : ""}${note ? ` ${note}` : ""}`);
  }, [saveMember]);

  const markRelationshipReviewed = useCallback(({ member, note }: { member: Member; note?: string }) => {
    const nextMember: Member = {
      ...member,
      relationshipReviewCompleted: true,
      relationshipReviewedAt: new Date().toISOString()
    };
    saveMember(nextMember, "Relationship review completed", `Relationship review marked complete for ${member.name}.${note ? ` ${note}` : ""}`);
  }, [saveMember]);

  const markReadyToAssign = useCallback(({ member, note }: { member: Member; note?: string }) => {
    if (member.currentForumId || member.assignedForumId) return;
    const labels = computeDataQualityLabels(member, relationships);
    if (!meetsRequiredFields(labels)) return;
    const nextMember: Member = { ...member, status: "Ready To Assign" };
    saveMember(nextMember, "Marked Ready To Assign", `${member.name} marked Ready To Assign.${note ? ` ${note}` : ""}`);
  }, [relationships, saveMember]);

  const getActiveShortlistsForForum = useCallback((forumId: string) => {
    const seen = new Set<string>();
    const result: LocalPlacementDecision[] = [];
    for (const decision of localPlacements) {
      if (decision.forumId !== forumId) continue;
      if (seen.has(decision.memberId)) continue;
      seen.add(decision.memberId);
      const member = membersById.get(decision.memberId);
      if (!member || member.currentForumId || member.assignedForumId || member.status === "Former Member") continue;
      if (decision.status === "Shortlisted") result.push(decision);
    }
    return result;
  }, [localPlacements, membersById]);

  const getRecentRejectionsForForum = useCallback((forumId: string, withinDays = 30) => {
    const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();
    const result: LocalPlacementDecision[] = [];
    for (const decision of localPlacements) {
      if (decision.forumId !== forumId) continue;
      if (seen.has(decision.memberId)) continue;
      seen.add(decision.memberId);
      if (decision.status !== "Rejected" && decision.status !== "Returned") continue;
      const createdAt = new Date(decision.createdAt).getTime();
      if (Number.isFinite(createdAt) && createdAt >= cutoff) result.push(decision);
    }
    return result;
  }, [localPlacements]);

  const isCurrentlyShortlistedForPair = useCallback((memberId: string, forumId: string) => {
    const member = membersById.get(memberId);
    if (!member || member.currentForumId || member.assignedForumId || member.status === "Former Member") return false;
    for (const decision of localPlacements) {
      if (decision.memberId !== memberId || decision.forumId !== forumId) continue;
      return decision.status === "Shortlisted";
    }
    return false;
  }, [localPlacements, membersById]);

  const getShortlistedForumIdsForMember = useCallback((memberId: string) => {
    const member = membersById.get(memberId);
    if (!member || member.currentForumId || member.assignedForumId || member.status === "Former Member") return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const decision of localPlacements) {
      if (decision.memberId !== memberId) continue;
      if (seen.has(decision.forumId)) continue;
      seen.add(decision.forumId);
      if (decision.status === "Shortlisted") result.push(decision.forumId);
    }
    return result;
  }, [localPlacements, membersById]);

  const addToShortlist = useCallback(({
    member,
    forum,
    note = "",
    reason
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
    reason?: DecisionReason;
  }) => {
    if (member.assignedForumId === forum.id) return;
    recordLocalDecision({
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status: "Shortlisted",
      note,
      reason,
      createdAt: new Date().toISOString()
    });
    const eligibleForShortlistFlag =
      member.status === "Free Agent" ||
      member.status === "New Member" ||
      member.status === "Ready To Assign" ||
      member.status === "Rejected" ||
      member.status === "Needs Conflict Review";
    if (eligibleForShortlistFlag) {
      saveMember({ ...member, status: "Shortlisted" }, "Added to shortlist", `${member.name} added to ${forum.name}'s shortlist.${note ? ` ${note}` : ""}`);
    } else {
      addActivity({
        type: "Added to shortlist",
        memberId: member.id,
        memberName: member.name,
        forumId: forum.id,
        forumName: forum.name,
        detail: `${member.name} added to ${forum.name}'s shortlist.${note ? ` ${note}` : ""}`
      });
    }
  }, [addActivity, recordLocalDecision, saveMember]);

  const removeFromShortlist = useCallback(({
    member,
    forum,
    note = ""
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
  }) => {
    const existing = parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey));
    const next = existing.filter((decision) => !(decision.memberId === member.id && decision.forumId === forum.id && decision.status === "Shortlisted"));
    window.localStorage.setItem(localPlacementStorageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));

    const stillShortlistedSomewhere = next.some((decision) => decision.memberId === member.id && decision.status === "Shortlisted");
    if (member.status === "Shortlisted" && !stillShortlistedSomewhere) {
      saveMember({ ...member, status: "Free Agent" }, "Removed from shortlist", `${member.name} removed from ${forum.name}'s shortlist.${note ? ` ${note}` : ""}`);
    } else {
      addActivity({
        type: "Removed from shortlist",
        memberId: member.id,
        memberName: member.name,
        forumId: forum.id,
        forumName: forum.name,
        detail: `${member.name} removed from ${forum.name}'s shortlist.${note ? ` ${note}` : ""}`
      });
    }
  }, [addActivity, saveMember]);

  const rejectPairing = useCallback(({
    member,
    forum,
    note = "",
    reason
  }: {
    member: Member;
    forum: ForumGroup;
    note?: string;
    reason?: DecisionReason;
  }) => {
    const rejectedForumIds = Array.from(new Set([...(member.rejectedForumIds ?? []), forum.id]));
    saveMember({ ...member, rejectedForumIds }, "Pairing rejected", `${forum.name} pairing rejected for ${member.name}.${reason ? ` Reason: ${reason}.` : ""}${note ? ` ${note}` : ""}`);
    recordLocalDecision({
      memberId: member.id,
      memberName: member.name,
      forumId: forum.id,
      forumName: forum.name,
      status: "Rejected",
      note,
      reason,
      createdAt: new Date().toISOString()
    });
  }, [recordLocalDecision, saveMember]);

  const addDecisionNote = useCallback(({
    member,
    forum,
    note,
    reason
  }: {
    member: Member;
    forum?: ForumGroup;
    note: string;
    reason?: DecisionReason;
  }) => {
    addActivity({
      type: "Decision note added",
      memberId: member.id,
      memberName: member.name,
      forumId: forum?.id,
      forumName: forum?.name,
      detail: `${reason ? `[${reason}] ` : ""}${note}`
    });
  }, [addActivity]);

  const logComparison = useCallback(({
    forum,
    members: comparedMembers,
    forums: comparedForums,
    member: subjectMember
  }: {
    forum?: ForumGroup;
    members?: Member[];
    forums?: ForumGroup[];
    member?: Member;
  }) => {
    if (forum && comparedMembers && comparedMembers.length > 0) {
      addActivity({
        type: "Candidate compared",
        forumId: forum.id,
        forumName: forum.name,
        detail: `Compared ${comparedMembers.length} candidate${comparedMembers.length === 1 ? "" : "s"} for ${forum.name}: ${comparedMembers.map((m) => m.name).join(", ")}.`
      });
    } else if (subjectMember && comparedForums && comparedForums.length > 0) {
      addActivity({
        type: "Candidate compared",
        memberId: subjectMember.id,
        memberName: subjectMember.name,
        detail: `Compared ${comparedForums.length} Forum${comparedForums.length === 1 ? "" : "s"} for ${subjectMember.name}: ${comparedForums.map((f) => f.name).join(", ")}.`
      });
    }
  }, [addActivity]);

  const mergeDuplicateCase = useCallback(({ caseId, primaryId, finalMember, note }: DuplicateMergePayload) => {
    const target = duplicateCases.find((item) => item.id === caseId);
    if (!target) return { ok: false, message: "Duplicate case not found." };
    const mergedMembers = mergeMembers(readJson<Member[]>(liveMembersKey, []));
    const memberA = mergedMembers.find((member) => member.id === target.memberAId);
    const memberB = target.memberBId ? mergedMembers.find((member) => member.id === target.memberBId) : target.draftMember;
    if (!memberA || !memberB) return { ok: false, message: "One of the duplicate records is no longer available." };

    const survivorBase = primaryId === memberA.id ? memberA : memberB;
    const mergedAway = primaryId === memberA.id ? memberB : memberA;
    const now = new Date().toISOString();
    const survivorId = survivorBase.id;
    const mergedId = mergedAway.id;

    if (memberA.currentForumId && memberB.currentForumId && memberA.currentForumId !== memberB.currentForumId && !finalMember.currentForumId) {
      addActivity({
        type: "Duplicate merge conflict detected",
        memberId: memberA.id,
        memberName: memberA.name,
        detail: `Merge conflict detected: ${memberA.name} and ${memberB.name} are in different Forums.`
      });
      return { ok: false, message: "Choose the surviving Forum/status before merging these In Forum records." };
    }

    const survivor: Member = {
      ...survivorBase,
      ...finalMember,
      id: survivorId,
      knownRelatives: combineMemberArrays(finalMember.knownRelatives, mergedAway.knownRelatives, survivorId, mergedId),
      spouseInChapter: combineMemberArrays(finalMember.spouseInChapter, mergedAway.spouseInChapter, survivorId, mergedId),
      businessPartners: combineMemberArrays(finalMember.businessPartners, mergedAway.businessPartners, survivorId, mergedId),
      previousBusinessRelationships: combineMemberArrays(finalMember.previousBusinessRelationships, mergedAway.previousBusinessRelationships, survivorId, mergedId),
      hardConflictMemberIds: combineMemberArrays(finalMember.hardConflictMemberIds, mergedAway.hardConflictMemberIds, survivorId, mergedId),
      directCompetitors: combineMemberArrays(finalMember.directCompetitors, mergedAway.directCompetitors, survivorId, mergedId),
      closeFriends: combineMemberArrays(finalMember.closeFriends, mergedAway.closeFriends, survivorId, mergedId),
      rejectedForumIds: unique([...(finalMember.rejectedForumIds ?? []), ...(mergedAway.rejectedForumIds ?? [])]),
      notes: mergeText(`${survivorBase.name} (${survivorBase.id})`, finalMember.notes, `${mergedAway.name} (${mergedAway.id})`, mergedAway.notes),
      intakeDisclosures: mergeDisclosures(finalMember.intakeDisclosures, mergedAway.intakeDisclosures),
      updatedAt: now
    };
    const archived: Member | undefined = target.memberBId || mergedMembers.some((member) => member.id === mergedId)
      ? {
        ...mergedAway,
        status: "Former Member",
        currentForumId: undefined,
        assignedForumId: undefined,
        assignmentStartDate: undefined,
        assignmentExpiresAt: undefined,
        notes: `${mergedAway.notes ? `${mergedAway.notes}\n\n` : ""}Merged duplicate into ${survivor.name} (${survivor.id}) on ${new Date(now).toLocaleDateString()}.`,
        updatedAt: now
      }
      : undefined;

    const nextMembers = mergedMembers
      .filter((member) => member.id !== survivorId && member.id !== mergedId)
      .concat([survivor, ...(archived ? [archived] : [])]);
    persistMembers(nextMembers);

    writeJson(liveRelationshipsKey, reassignRelationships(relationships, survivorId, mergedId));

    const placementExisting = parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey));
    const placementByKey = new Map<string, LocalPlacementDecision>();
    for (const decision of placementExisting) {
      const nextDecision = decision.memberId === mergedId
        ? { ...decision, memberId: survivorId, memberName: survivor.name }
        : decision;
      placementByKey.set(`${nextDecision.memberId}-${nextDecision.forumId}-${nextDecision.status}`, nextDecision);
    }
    window.localStorage.setItem(localPlacementStorageKey, JSON.stringify(Array.from(placementByKey.values())));
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));

    const existingCases = readJson<DuplicateCase[]>(liveDuplicateCasesKey, []);
    const closedCase: DuplicateCase = { ...target, status: "Merged", updatedAt: now, resolvedAt: now, note };
    persistDuplicateCases([closedCase, ...existingCases.filter((item) => item.id !== caseId)]);

    const existingActivity = readJson<ActivityEvent[]>(liveActivityKey, []);
    const rehomedActivity = existingActivity.map((event) => event.memberId === mergedId ? { ...event, memberId: survivorId, memberName: survivor.name } : event);
    const newEvents: ActivityEvent[] = [
      {
        id: activityId(),
        createdAt: now,
        type: "Duplicate merge reviewed",
        memberId: survivorId,
        memberName: survivor.name,
        detail: `Reviewed duplicate records ${memberA.name} (${memberA.id}) and ${memberB.name} (${memberB.id}).`
      },
      {
        id: activityId(),
        createdAt: now,
        type: "Duplicate merge completed",
        memberId: survivorId,
        memberName: survivor.name,
        forumId: survivor.currentForumId ?? survivor.assignedForumId,
        forumName: forumsById.get(survivor.currentForumId ?? survivor.assignedForumId ?? "")?.name,
        detail: `Merged duplicate member ${mergedAway.name}/${mergedAway.id} into this record.${note ? ` ${note}` : ""}`
      },
      {
        id: activityId(),
        createdAt: now,
        type: "Member merged into another member",
        memberId: mergedId,
        memberName: mergedAway.name,
        detail: `${mergedAway.name} was archived as a merged duplicate of ${survivor.name} (${survivor.id}).`
      }
    ];
    writeJson(liveActivityKey, [...newEvents, ...rehomedActivity].slice(0, 220));
    return { ok: true, message: `${mergedAway.name} merged into ${survivor.name}.` };
  }, [addActivity, duplicateCases, forumsById, persistDuplicateCases, persistMembers, relationships]);

  const demoStorageKeys = useMemo(() => [
    liveMembersKey,
    liveRelationshipsKey,
    liveActivityKey,
    liveImportSummariesKey,
    liveDuplicateCasesKey,
    localPlacementStorageKey
  ], []);

  const saveDemoMetadata = useCallback((metadata: DemoToolsMetadata) => {
    const next = { ...readJson<DemoToolsMetadata>(liveDemoToolsKey, {}), ...metadata };
    window.localStorage.setItem(liveDemoToolsKey, JSON.stringify(next));
    window.dispatchEvent(new Event(liveDataUpdatedEvent));
  }, []);

  const resetToDemoData = useCallback(() => {
    demoStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    saveDemoMetadata({ lastResetAt: new Date().toISOString() });
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));
  }, [demoStorageKeys, saveDemoMetadata]);

  const clearLocalChanges = useCallback(() => {
    demoStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    saveDemoMetadata({ lastClearedAt: new Date().toISOString() });
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));
  }, [demoStorageKeys, saveDemoMetadata]);

  const exportLocalData = useCallback((): LocalDataBackup => {
    const backup: LocalDataBackup = {
      exportedAt: new Date().toISOString(),
      members: readJson<Member[]>(liveMembersKey, []),
      relationships: readJson<MemberRelationship[]>(liveRelationshipsKey, []),
      activity: readJson<ActivityEvent[]>(liveActivityKey, []),
      placements: parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)),
      importSummaries: readJson<ImportSummary[]>(liveImportSummariesKey, []),
      duplicateCases: readJson<DuplicateCase[]>(liveDuplicateCasesKey, []),
      demoTools: readJson<DemoToolsMetadata>(liveDemoToolsKey, {})
    };
    saveDemoMetadata({ lastExportAt: backup.exportedAt });
    return backup;
  }, [saveDemoMetadata]);

  const importLocalData = useCallback((backup: LocalDataBackup) => {
    window.localStorage.setItem(liveMembersKey, JSON.stringify(Array.isArray(backup.members) ? backup.members : []));
    window.localStorage.setItem(liveRelationshipsKey, JSON.stringify(Array.isArray(backup.relationships) ? backup.relationships : []));
    window.localStorage.setItem(liveActivityKey, JSON.stringify(Array.isArray(backup.activity) ? backup.activity : []));
    window.localStorage.setItem(localPlacementStorageKey, JSON.stringify(Array.isArray(backup.placements) ? backup.placements : []));
    window.localStorage.setItem(liveImportSummariesKey, JSON.stringify(Array.isArray(backup.importSummaries) ? backup.importSummaries : []));
    window.localStorage.setItem(liveDuplicateCasesKey, JSON.stringify(Array.isArray(backup.duplicateCases) ? backup.duplicateCases : []));
    saveDemoMetadata({ ...(backup.demoTools ?? {}), lastImportAt: new Date().toISOString() });
    window.dispatchEvent(new Event(localPlacementUpdatedEvent));
  }, [saveDemoMetadata]);

  const getLocalDataStatus = useCallback(() => ({
    changedMembers: typeof window === "undefined" ? 0 : readJson<Member[]>(liveMembersKey, []).length,
    relationships: typeof window === "undefined" ? 0 : readJson<MemberRelationship[]>(liveRelationshipsKey, []).length,
    activityEvents: typeof window === "undefined" ? 0 : readJson<ActivityEvent[]>(liveActivityKey, []).length,
    localPlacementDecisions: typeof window === "undefined" ? 0 : parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)).length,
    importSummaries: typeof window === "undefined" ? 0 : readJson<ImportSummary[]>(liveImportSummariesKey, []).length,
    duplicateCases: typeof window === "undefined" ? 0 : readJson<DuplicateCase[]>(liveDuplicateCasesKey, []).length
  }), []);

  const getMemberById = useCallback((memberId: string) => membersById.get(memberId), [membersById]);
  const getForumById = useCallback((forumId: string) => forumsById.get(forumId), [forumsById]);
  const getDuplicateCasesForMember = useCallback((memberId: string) => duplicateCasesByMemberId.get(memberId) ?? [], [duplicateCasesByMemberId]);
  const getDataQuality = useCallback((member: Member): DataQualityLabel[] => {
    const labels = getMemberDataQuality(member, relationshipsByMemberId.get(member.id) ?? []);
    return openDuplicateMemberIds.has(member.id) && !labels.includes("Possible Duplicate")
      ? labels[0] === "Complete" ? ["Possible Duplicate" as DataQualityLabel] : [...labels, "Possible Duplicate" as DataQualityLabel]
      : labels;
  }, [openDuplicateMemberIds, relationshipsByMemberId]);

  return {
    members,
    forums,
    relationships,
    placements,
    activity: mergedActivity,
    localPlacements,
    saveMember,
    addMember,
    addMembersBulk,
    updateMembersBulk,
    addImportActivities,
    recordImportSummary,
    importSummaries,
    demoTools,
    resetToDemoData,
    clearLocalChanges,
    exportLocalData,
    importLocalData,
    getLocalDataStatus,
    duplicateCases,
    recordDuplicateCase,
    mergeDuplicateCase,
    markDuplicateNotDuplicate: (caseId: string, note?: string) => updateDuplicateCaseStatus(caseId, "Not Duplicate", "Duplicate marked not duplicate", note),
    skipDuplicateCase: (caseId: string, note?: string) => updateDuplicateCaseStatus(caseId, "Skipped", "Duplicate merge skipped", note),
    archiveDuplicateCase: (caseId: string, note?: string) => updateDuplicateCaseStatus(caseId, "Archived", "Duplicate merge skipped", note),
    saveRelationship,
    recordPlacementDecision,
    assignToForum,
    confirmInForum,
    rejectAssignment,
    returnToFreeAgent,
    markAssignmentExpired,
    updateMemberStatus,
    markRelationshipReviewed,
    markReadyToAssign,
    submitIntake,
    markIntakeReviewed,
    archiveIntake,
    findPossibleDuplicates,
    addToShortlist,
    removeFromShortlist,
    rejectPairing,
    addDecisionNote,
    logComparison,
    getActiveShortlistsForForum,
    getRecentRejectionsForForum,
    isCurrentlyShortlistedForPair,
    getShortlistedForumIdsForMember,
    getMemberById,
    getForumById,
    getDuplicateCasesForMember,
    getDataQuality,
    getMissingRequiredFields: (member: Member) => missingRequiredFields(getDataQuality(member)),
    isReadyToAssign: (member: Member) => meetsRequiredFields(getDataQuality(member)),
    hasMissingRequiredFields: (member: Member) => hasMissingRequiredFields(getDataQuality(member)),
    isStaleRecord: (member: Member) => isStaleRecord(member),
    daysSinceUpdate: (member: Member) => daysSinceUpdate(member),
    getEffectiveStatus
  };
}

type LiveDataValue = ReturnType<typeof useLiveDataValue>;

const LiveDataContext = createContext<LiveDataValue | null>(null);

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const value = useLiveDataValue();
  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData() {
  const value = useContext(LiveDataContext);
  if (!value) {
    throw new Error("useLiveData must be used inside LiveDataProvider.");
  }
  return value;
}
