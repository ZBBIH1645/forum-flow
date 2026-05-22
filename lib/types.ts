export type MemberStatus =
  | "New Member"
  | "Free Agent"
  | "In Forum"
  | "Needs Info"
  | "Needs Conflict Review"
  | "Ready To Assign"
  | "Shortlisted"
  | "Pending Approval"
  | "Assigned / Pending Forum Review"
  | "Rejected"
  | "Assignment Expired"
  | "Placed"
  | "On Hold"
  | "Former Member";
export type ForumStyle = "Business-focused" | "Balanced" | "Personal/deeper discussion" | "Social/travel-heavy";
export type BusinessStage = "Startup" | "Growth" | "Scaling" | "Mature" | "Transition";
export type Gender = "Woman" | "Man";
export type CompatibilityLabel = "Best Fit" | "Good Fit" | "Possible Fit" | "Needs Review" | "Blocked";
export type RelationshipType =
  | "Blood relative"
  | "Spouse"
  | "Current business partner"
  | "Former business partner"
  | "Prior business relationship"
  | "Direct competitor"
  | "Close friend"
  | "Personal conflict"
  | "Other";
export type RelationshipSeverity = "Blocked" | "Needs Review" | "Note Only";
export type DataQualityLabel =
  | "Complete"
  | "Missing Home Location"
  | "Missing Business Location"
  | "Missing Revenue"
  | "Missing Years in Business"
  | "Missing DOB"
  | "Missing Industry"
  | "Missing Relationship Review"
  | "Has Hard Conflicts"
  | "Possible Duplicate"
  | "Stale Record"
  | "Needs Review";

export type DecisionReason =
  | "Industry Conflict"
  | "Relationship Conflict"
  | "Better Fit Elsewhere"
  | "Location Mismatch"
  | "Business Stage Mismatch"
  | "Waiting On Info"
  | "Approved By Placement Chair"
  | "Forum Accepted"
  | "Forum Rejected"
  | "Assignment Expired"
  | "Other";

export type Member = {
  id: string;
  name: string;
  company: string;
  industry: string;
  businessLocation: string;
  homeLocation: string;
  gender: Gender;
  age: number;
  ageRange: string;
  /** ISO date string (YYYY-MM-DD). When present, age should be calculated from this. */
  dateOfBirth?: string;
  revenueRange: string;
  employeeCount: number;
  yearsInBusiness: number;
  businessStage: BusinessStage;
  status: MemberStatus;
  forumStylePreference: ForumStyle;
  knownRelatives: string[];
  spouseInChapter: string[];
  businessPartners: string[];
  previousBusinessRelationships: string[];
  hardConflictMemberIds: string[];
  directCompetitors: string[];
  closeFriends: string[];
  notes: string;
  /** Forum the member is officially "In Forum" with. Cleared on rejection. */
  currentForumId?: string;
  /** Forum the member is currently assigned to but not yet confirmed. */
  assignedForumId?: string;
  /** ISO timestamp when assignment was made. */
  assignmentStartDate?: string;
  /** ISO timestamp when 90-day window expires. */
  assignmentExpiresAt?: string;
  /** Forums that previously rejected this member, used to suppress as top suggestion. */
  rejectedForumIds?: string[];
  /** ISO timestamp when this profile was last updated. Drives stale-record detection. */
  updatedAt?: string;
  /** True if a placement picker has explicitly reviewed this member's relationships. */
  relationshipReviewCompleted?: boolean;
  /** ISO timestamp when relationship review was last marked complete. */
  relationshipReviewedAt?: string;
  /** ISO timestamp when this record came in via the public intake form. */
  intakeSubmittedAt?: string;
  /** Free-text relationship disclosures collected at intake. */
  intakeDisclosures?: IntakeDisclosures;
};

export type IntakeDisclosures = {
  bloodRelatives?: string;
  spouse?: string;
  currentBusinessPartners?: string;
  formerBusinessPartners?: string;
  priorBusinessRelationships?: string;
  directCompetitors?: string;
  closeFriends?: string;
  otherNotes?: string;
};

export type ForumGroup = {
  id: string;
  name: string;
  maxDesiredSize: number;
  mainLocationZone: string;
  currentMemberIds: string[];
  forumStyle: ForumStyle;
  groupNotes: string;
  specialExpectations: string;
};

export type CompatibilityReview = {
  member: Member;
  forum: ForumGroup;
  label: CompatibilityLabel;
  positiveSignals: string[];
  hardBlockers: string[];
  softWarnings: string[];
  summary: string;
};

export type PlacementDecision = {
  id: string;
  memberId: string;
  forumId: string;
  status: "Shortlisted" | "Needs Review" | "Rejected" | "Approved" | "Placed";
  reason: string;
};

export type MemberRelationship = {
  id: string;
  memberId: string;
  relatedMemberId: string;
  type: RelationshipType;
  severity: RelationshipSeverity;
  notes: string;
  reviewed?: boolean;
  reviewedAt?: string;
  reviewNote?: string;
};

export type ActivityEvent = {
  id: string;
  createdAt: string;
  type:
    | "Member added"
    | "Member edited"
    | "Status changed"
    | "Placement approved"
    | "Member moved into Forum"
    | "Member assigned to Forum"
    | "Forum confirmed member"
    | "Forum rejected member"
    | "Assignment expired"
    | "Member returned to Free Agent"
    | "Conflict added"
    | "Conflict reviewed"
    | "Match rejected"
    | "Match shortlisted"
    | "Added to shortlist"
    | "Removed from shortlist"
    | "Candidate compared"
    | "Pairing rejected"
    | "Decision note added"
    | "Relationship review completed"
    | "Marked Ready To Assign"
    | "Intake submitted"
    | "Intake reviewed"
    | "Archived intake"
    | "Possible duplicate flagged"
    | "Needs review"
    | "Import started"
    | "Import preview generated"
    | "Member imported"
    | "Member updated by import"
    | "Import row skipped"
    | "Import duplicate flagged"
    | "Import completed"
    | "Duplicate merge reviewed"
    | "Duplicate merge completed"
    | "Duplicate merge skipped"
    | "Duplicate marked not duplicate"
    | "Duplicate merge conflict detected"
    | "Member merged into another member";
  memberId?: string;
  memberName?: string;
  forumId?: string;
  forumName?: string;
  detail: string;
};

export type DuplicateConfidence = "Likely Duplicate" | "Possible Duplicate" | "Weak Match";
export type DuplicateSource = "Intake" | "Import" | "Manual";
export type DuplicateStatus = "Unresolved" | "Skipped" | "Not Duplicate" | "Merged" | "Archived";

export type DuplicateCase = {
  id: string;
  memberAId: string;
  memberBId?: string;
  draftMember?: Member;
  source: DuplicateSource;
  confidence: DuplicateConfidence;
  reasons: string[];
  status: DuplicateStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  importSummaryId?: string;
  rowNumber?: number;
  rowName?: string;
  note?: string;
};
