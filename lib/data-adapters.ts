import {
  activityEvents,
  forums,
  memberRelationships,
  members,
  placementDecisions
} from "./mock-data";
import type { ActivityEvent, DuplicateCase, ForumGroup, Member, MemberRelationship, PlacementDecision } from "./types";
import type { LocalPlacementDecision } from "./local-placements";

export type ForumFlowDataSnapshot = {
  members: Member[];
  forums: ForumGroup[];
  relationships: MemberRelationship[];
  placementDecisions: PlacementDecision[];
  activity: ActivityEvent[];
  localPlacements?: LocalPlacementDecision[];
  duplicateCases?: DuplicateCase[];
};

export const demoDataAdapter = {
  name: "demo",
  loadSeed(): ForumFlowDataSnapshot {
    return {
      members,
      forums,
      relationships: memberRelationships,
      placementDecisions,
      activity: activityEvents
    };
  }
};

export const localStorageAdapter = {
  name: "localStorage",
  description: "Browser-only persistence for demo edits, local imports, duplicate cases, and activity."
};

export const importDataAdapter = {
  name: "csvImport",
  description: "CSV preview, field mapping, row validation, and local commit into the live browser state."
};

export const futureBackendAdapter = {
  name: "futureBackend",
  description: "Placeholder boundary for Supabase/backend persistence. Not implemented in this MVP."
};
