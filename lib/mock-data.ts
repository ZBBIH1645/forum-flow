import type { ActivityEvent, BusinessStage, ForumGroup, ForumStyle, Gender, Member, MemberRelationship, PlacementDecision } from "./types";

const firstNames = [
  "Ari", "Daniela", "Mateo", "Sofia", "Nico", "Isabel", "Julian", "Camila", "Evan", "Marisol",
  "Rafael", "Natalie", "Lucas", "Valentina", "Andre", "Gabriela", "Maya", "Diego", "Elena", "Jonah"
];
const lastNames = [
  "Alvarez", "Benitez", "Cohen", "Delgado", "Espinosa", "Fernandez", "Goldberg", "Herrera", "Kaplan", "Levine",
  "Mendoza", "Navarro", "Ortega", "Pereira", "Rosen", "Santiago", "Torres", "Valdes", "Weiss", "Zamora"
];
const industries = [
  "Law",
  "Real Estate",
  "Construction",
  "Healthcare",
  "Hospitality",
  "Finance",
  "Insurance",
  "Marketing",
  "Manufacturing",
  "Logistics",
  "SaaS",
  "Professional Services",
  "Retail",
  "Home Services",
  "Wealth Management",
  "Medical Practice",
  "Restaurant Group"
];
const zones = ["Miami", "Coral Gables", "Aventura", "Fort Lauderdale", "Boca Raton", "Delray Beach", "Palm Beach", "West Palm Beach", "Hollywood", "Plantation"];
const ageRanges = ["30-39", "40-49", "50-59", "60+"];
const revenueRanges = ["$1M-$3M", "$3M-$10M", "$10M-$25M", "$25M+"];
const stages: BusinessStage[] = ["Startup", "Growth", "Scaling", "Mature", "Transition"];
const styles: ForumStyle[] = ["Business-focused", "Balanced", "Personal/deeper discussion", "Social/travel-heavy"];
const genders: Gender[] = ["Woman", "Man"];

const forumNotes = [
  "Social and travel-heavy group that usually plans one premium annual trip.",
  "Mostly established operators with 15+ years running mature companies.",
  "Younger, growth-stage owners who trade tactical scaling issues.",
  "Deeper personal discussion style; strong fit requires careful relationship review.",
  "Business-focused operators who prefer direct issue processing and clear follow-up.",
  "One open seat and several strong candidate options; review conflicts before invite."
];

const creativeForumNames = [
  "Harbor Forum",
  "Atlantic Forum",
  "Cypress Forum",
  "Meridian Forum",
  "Banyan Forum",
  "Summit Forum",
  "Everglades Forum",
  "Lighthouse Forum",
  "Palms Forum",
  "Gulfstream Forum",
  "Mangrove Forum",
  "Coral Forum",
  "Horizon Forum",
  "Beacon Forum",
  "Bayfront Forum",
  "Sandpiper Forum",
  "Trade Winds Forum",
  "Coastline Forum",
  "Compass Forum",
  "Keystone Forum",
  "Skyline Forum",
  "Waterway Forum",
  "Pinnacle Forum",
  "Driftwood Forum"
];

const forumSpecs = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  return {
    id: `forum-${String(number).padStart(2, "0")}`,
    name: creativeForumNames[index % creativeForumNames.length],
    maxDesiredSize: 10,
    mainLocationZone: zones[index % zones.length],
    forumStyle: styles[index % styles.length],
    groupNotes: forumNotes[index % forumNotes.length],
    specialExpectations: index % 6 === 0 ? "Annual travel commitment around $5K." : index % 6 === 1 ? "Prefers established operators." : "Standard monthly Forum expectations."
  };
});

const forumAssignments = forumSpecs.flatMap((forum, index) => Array.from({ length: 6 + (index % 5) }, () => forum.id));

const assignedForumIdFor = (index: number) => {
  return forumAssignments[index - 1];
};

const companyNouns: Record<string, string[]> = {
  Law: ["Legal Group", "Trial Counsel", "Business Law"],
  "Real Estate": ["Property Partners", "Capital Realty", "Development Group"],
  Construction: ["Build Group", "Coastal Construction", "Interiors"],
  Healthcare: ["Care Partners", "Health Advisors", "Wellness Group"],
  Hospitality: ["Hotel Group", "Hospitality Partners", "Resort Management"],
  Finance: ["Capital Advisors", "Finance Group", "Funding Partners"],
  Insurance: ["Risk Advisors", "Insurance Group", "Benefits Partners"],
  Marketing: ["Creative Studio", "Growth Agency", "Brand Partners"],
  Manufacturing: ["Fabrication", "Manufacturing Co.", "Packaging Group"],
  Logistics: ["Freight Partners", "Logistics Group", "Supply Chain"],
  SaaS: ["Software", "Cloud Systems", "Workflow Labs"],
  "Professional Services": ["Advisory Group", "Consulting Partners", "Operations Advisors"],
  Retail: ["Market Group", "Retail Partners", "Lifestyle Stores"],
  "Home Services": ["Home Pros", "Property Services", "Restoration Group"],
  "Wealth Management": ["Wealth Advisors", "Family Office", "Private Wealth"],
  "Medical Practice": ["Medical Group", "Specialty Care", "Physician Partners"],
  "Restaurant Group": ["Restaurant Group", "Kitchen Collective", "Hospitality Concepts"]
};

const companyFor = (index: number, industry: string) => {
  const options = companyNouns[industry] ?? ["Ventures", "Group", "Partners"];
  return `${lastNames[index % lastNames.length]} ${options[index % options.length]}`;
};

const relatedMemberId = (index: number, offset: number) => `mem-${String(((index + offset - 1) % 307) + 1).padStart(3, "0")}`;

// Approximate "today" used for deterministic mock dates. Live computations use real Date.now().
const MOCK_REFERENCE_ISO = "2026-05-09";

const dobFromAge = (age: number, index: number) => {
  const reference = new Date(MOCK_REFERENCE_ISO);
  const birthYear = reference.getUTCFullYear() - age;
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String(((index * 7) % 27) + 1).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
};

export const chapterFacts = {
  name: "Forum Placement Dashboard",
  asOf: "May 09, 2026",
  foundedYear: 1997,
  memberCount: 307,
  medianMemberSales: "USD $3 million",
  totalEmployees: 15056,
  averageEmployees: 50,
  medianEmployees: 13,
  averageMemberAge: 49,
  medianMemberAge: 51,
  industriesRepresented: industries
};

// A handful of free agents that we'll seed as currently assigned (pending forum review),
// to demonstrate the assignment workflow on first load.
const seededAssignments: Record<string, { forumId: string; daysAgo: number }> = {
  "mem-007": { forumId: "forum-04", daysAgo: 12 },
  "mem-019": { forumId: "forum-09", daysAgo: 35 },
  "mem-031": { forumId: "forum-02", daysAgo: 81 },
  "mem-052": { forumId: "forum-15", daysAgo: 95 } // already expired
};

const specialMemberOverrides: Record<string, Partial<Member>> = {
  "mem-007": {
    name: "Daniela Fernandez",
    company: "Fernandez Coastal Construction",
    industry: "Construction",
    businessLocation: "Fort Lauderdale",
    homeLocation: "Plantation",
    notes: "Assigned to a deeper-discussion Forum after chair review. Forum asked for a quick check on prior vendor relationships."
  },
  "mem-019": {
    name: "Rafael Cohen",
    company: "Cohen Growth Agency",
    industry: "Marketing",
    businessLocation: "Miami",
    homeLocation: "Coral Gables",
    notes: "Strong culture fit for a business-focused Forum; chair is waiting on Forum feedback."
  },
  "mem-031": {
    name: "Isabel Navarro",
    company: "Navarro Private Wealth",
    industry: "Wealth Management",
    businessLocation: "Boca Raton",
    homeLocation: "Delray Beach",
    notes: "Assignment is inside the final two weeks of the 90-day review window. Needs follow-up before expiration."
  },
  "mem-052": {
    name: "Mateo Alvarez",
    company: "Alvarez Restaurant Group",
    industry: "Restaurant Group",
    businessLocation: "Miami",
    homeLocation: "Aventura",
    notes: "Assignment window expired. Good demo case for returning a member to Free Agent or reassigning."
  },
  "mem-197": {
    name: "Sofia Valdes",
    company: "Valdes Family Law",
    industry: "Law",
    businessLocation: "",
    homeLocation: "Coral Gables",
    status: "Needs Info",
    relationshipReviewCompleted: true,
    notes: "Needs business location confirmed before placement."
  },
  "mem-205": {
    name: "Andre Rosen",
    company: "Rosen Risk Advisors",
    industry: "Insurance",
    businessLocation: "Hollywood",
    homeLocation: "Aventura",
    status: "Needs Conflict Review",
    relationshipReviewCompleted: false,
    notes: "Disclosed a prior partnership and a direct competitor in the chapter."
  },
  "mem-216": {
    name: "Camila Pereira",
    company: "Pereira Cloud Systems",
    industry: "SaaS",
    businessLocation: "Boca Raton",
    homeLocation: "West Palm Beach",
    status: "Ready To Assign",
    relationshipReviewCompleted: true,
    notes: "Clean record, growth-stage SaaS founder, prefers a business-focused Forum."
  },
  "mem-224": {
    name: "Julian Mendoza",
    company: "Mendoza Property Partners",
    industry: "Real Estate",
    businessLocation: "Fort Lauderdale",
    homeLocation: "Hollywood",
    status: "Shortlisted",
    relationshipReviewCompleted: true,
    notes: "Shortlisted for a Forum with one open seat; compare against other real estate exposure."
  },
  "mem-241": {
    name: "Natalie Ortega",
    company: "Ortega Medical Group",
    industry: "Medical Practice",
    businessLocation: "Palm Beach",
    homeLocation: "West Palm Beach",
    status: "Ready To Assign",
    relationshipReviewCompleted: true,
    notes: "Excellent candidate for an established-operator Forum. No disclosed conflicts."
  },
  "mem-252": {
    name: "Evan Goldberg",
    company: "Goldberg Capital Realty",
    industry: "Real Estate",
    businessLocation: "Boca Raton",
    homeLocation: "Delray Beach",
    status: "Needs Conflict Review",
    relationshipReviewCompleted: false,
    notes: "Direct competitor disclosure should be reviewed before any assignment."
  },
  "mem-267": {
    name: "Marisol Torres",
    company: "Torres Hospitality Concepts",
    industry: "Hospitality",
    businessLocation: "Miami",
    homeLocation: "Coral Gables",
    status: "Free Agent",
    relationshipReviewCompleted: true,
    rejectedForumIds: ["forum-15"],
    notes: "Recently returned to the Free Agent pool after Forum 15 declined due to a prior business relationship."
  },
  "mem-288": {
    name: "Gabriela Santiago",
    company: "Santiago Home Pros",
    industry: "Home Services",
    businessLocation: "Plantation",
    homeLocation: "Fort Lauderdale",
    status: "Free Agent",
    relationshipReviewCompleted: false,
    intakeSubmittedAt: "2026-05-04T14:30:00.000Z",
    intakeDisclosures: {
      priorBusinessRelationships: "Worked with a current member on a commercial buildout in 2022.",
      directCompetitors: "One Fort Lauderdale home services owner may overlap by service area.",
      otherNotes: "Prefers practical business issue processing over social-heavy groups."
    },
    notes: "New intake record. Review disclosures before assignment."
  },
  "mem-301": {
    name: "Nicolas Benitez",
    company: "Benitez Logistics Group",
    industry: "Logistics",
    businessLocation: "Doral",
    homeLocation: "Miami",
    status: "Free Agent",
    relationshipReviewCompleted: true,
    updatedAt: "2025-08-12T12:00:00.000Z",
    notes: "Stale record demo: revenue and headcount should be confirmed before assignment."
  },
  "mem-302": {
    name: "Nico Benitez",
    company: "Benitez Logistics Group",
    industry: "Logistics",
    businessLocation: "Miami",
    homeLocation: "Miami",
    status: "New Member",
    relationshipReviewCompleted: false,
    intakeSubmittedAt: "2026-05-07T16:10:00.000Z",
    notes: "Possible duplicate of Nicolas Benitez from intake/import review."
  }
};

const isoDaysAgo = (days: number) => {
  const reference = new Date(MOCK_REFERENCE_ISO);
  reference.setUTCDate(reference.getUTCDate() - days);
  return reference.toISOString();
};
const isoDaysFromAssignment = (startedDaysAgo: number) => {
  const reference = new Date(MOCK_REFERENCE_ISO);
  reference.setUTCDate(reference.getUTCDate() - startedDaysAgo + 90);
  return reference.toISOString();
};

export const members: Member[] = Array.from({ length: chapterFacts.memberCount }, (_, zeroIndex) => {
  const index = zeroIndex + 1;
  const id = `mem-${String(index).padStart(3, "0")}`;
  const industry = industries[index % industries.length];
  const seeded = seededAssignments[id];
  const currentForumId = seeded ? undefined : assignedForumIdFor(index);
  const freeAgent = !currentForumId;
  const needsReview = freeAgent && index % 9 === 0;
  const spouse = freeAgent && index % 43 === 0 ? [relatedMemberId(index, 12)] : [];
  const relatives = freeAgent && index % 37 === 0 ? [relatedMemberId(index, 5)] : [];
  const partners = freeAgent && index % 41 === 0 ? [relatedMemberId(index, 19)] : [];
  const previousRelationships = freeAgent && index % 47 === 0 ? [relatedMemberId(index, 23)] : [];
  const hardConflictMemberIds = freeAgent && index % 53 === 0 ? [relatedMemberId(index, 31)] : [];
  const competitors = freeAgent && index % 4 === 0 ? [relatedMemberId(index, 7)] : [];
  const closeFriends = freeAgent && index % 6 === 0 ? [relatedMemberId(index, 15)] : [];

  const age = 33 + ((index * 5) % 34);

  // Stale records: ~18% are >180 days old, ~12% are 60-180 days, the rest are recent.
  const updatedDaysAgo = index % 17 === 0
    ? 240 + (index % 60)
    : index % 23 === 0
    ? 200 + (index % 30)
    : index % 11 === 0
    ? 95 + (index % 30)
    : index % 7 === 0
    ? 30 + (index % 20)
    : (index % 14);

  // Members already In Forum or Assigned have had their relationships reviewed.
  // Free agents: ~60% reviewed, ~40% not.
  const reviewed = !!currentForumId || (freeAgent && index % 5 !== 0 && index % 7 !== 1);
  // A small slice of free agents are "incomplete" — missing required fields, to demo the dashboard.
  const incompleteIndustry = freeAgent && index % 31 === 0;
  const incompleteHomeLocation = freeAgent && index % 29 === 0;
  const incompleteBusinessLocation = freeAgent && index % 33 === 0;
  const incompleteRevenue = freeAgent && index % 37 === 0;
  const incompleteYears = freeAgent && index % 39 === 0;
  const incompleteDob = freeAgent && index % 41 === 0;

  const assignmentStart = seeded ? isoDaysAgo(seeded.daysAgo) : undefined;
  const assignmentEnd = seeded ? isoDaysFromAssignment(seeded.daysAgo) : undefined;
  const assignmentStatus = seeded
    ? (seeded.daysAgo > 90 ? "Assignment Expired" : "Assigned / Pending Forum Review")
    : undefined;

  const baseMember: Member = {
    id,
    name: `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`,
    company: companyFor(index, industry),
    industry: incompleteIndustry ? "" : industry,
    businessLocation: incompleteBusinessLocation ? "" : zones[(index + 2) % zones.length],
    homeLocation: incompleteHomeLocation ? "" : zones[index % zones.length],
    gender: genders[index % genders.length],
    age,
    ageRange: ageRanges[index % ageRanges.length],
    dateOfBirth: incompleteDob ? undefined : dobFromAge(age, index),
    revenueRange: incompleteRevenue ? "" : revenueRanges[index % revenueRanges.length],
    employeeCount: 8 + ((index * 7) % 260),
    yearsInBusiness: incompleteYears ? 0 : 2 + (index % 28),
    businessStage: stages[index % stages.length],
    status: assignmentStatus
      ?? (freeAgent ? (needsReview ? "Needs Conflict Review" : "Free Agent") : "In Forum"),
    forumStylePreference: styles[(index + 1) % styles.length],
    knownRelatives: relatives,
    spouseInChapter: spouse,
    businessPartners: partners,
    previousBusinessRelationships: previousRelationships,
    hardConflictMemberIds,
    directCompetitors: competitors,
    closeFriends,
    notes: freeAgent && index % 10 === 0 ? "Placement picker should review travel expectations and relationship disclosures before approval." : "",
    currentForumId,
    assignedForumId: seeded?.forumId,
    assignmentStartDate: assignmentStart,
    assignmentExpiresAt: assignmentEnd,
    rejectedForumIds: [],
    updatedAt: isoDaysAgo(updatedDaysAgo),
    relationshipReviewCompleted: reviewed,
    relationshipReviewedAt: reviewed ? isoDaysAgo(Math.min(updatedDaysAgo + 5, 200)) : undefined
  };

  return {
    ...baseMember,
    ...(specialMemberOverrides[id] ?? {})
  };
});

export const forums: ForumGroup[] = forumSpecs.map((forum) => ({
  ...forum,
  currentMemberIds: members.filter((member) => member.currentForumId === forum.id).map((member) => member.id)
}));

export const freeAgents = members.filter((member) => !member.currentForumId && !member.assignedForumId);
export const membersInForums = members.filter((member) => Boolean(member.currentForumId));

export const memberRelationships: MemberRelationship[] = members.flatMap((member) => [
  ...member.knownRelatives.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-blood`,
    memberId: member.id,
    relatedMemberId,
    type: "Blood relative" as const,
    severity: "Blocked" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.spouseInChapter.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-spouse`,
    memberId: member.id,
    relatedMemberId,
    type: "Spouse" as const,
    severity: "Blocked" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.businessPartners.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-partner`,
    memberId: member.id,
    relatedMemberId,
    type: "Current business partner" as const,
    severity: "Blocked" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.previousBusinessRelationships.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-prior`,
    memberId: member.id,
    relatedMemberId,
    type: "Prior business relationship" as const,
    severity: "Blocked" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.hardConflictMemberIds.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-conflict`,
    memberId: member.id,
    relatedMemberId,
    type: "Personal conflict" as const,
    severity: "Blocked" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.directCompetitors.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-competitor`,
    memberId: member.id,
    relatedMemberId,
    type: "Direct competitor" as const,
    severity: "Needs Review" as const,
    notes: "Legacy relationship disclosure."
  })),
  ...member.closeFriends.map((relatedMemberId) => ({
    id: `rel-${member.id}-${relatedMemberId}-friend`,
    memberId: member.id,
    relatedMemberId,
    type: "Close friend" as const,
    severity: "Needs Review" as const,
    notes: "Legacy relationship disclosure."
  }))
]);

export const placementDecisions: PlacementDecision[] = [
  {
    id: "decision-001",
    memberId: "mem-241",
    forumId: "forum-03",
    status: "Approved",
    reason: "Compatible stage, adds industry variety, no hard blockers disclosed."
  },
  {
    id: "decision-002",
    memberId: "mem-252",
    forumId: "forum-08",
    status: "Needs Review",
    reason: "Direct competitor relationship should be reviewed before final placement."
  },
  {
    id: "decision-003",
    memberId: "mem-267",
    forumId: "forum-15",
    status: "Rejected",
    reason: "Prior business relationship with a current member creates too much risk."
  }
];

export const activityEvents: ActivityEvent[] = [
  {
    id: "demo-act-001",
    createdAt: "2026-05-09T15:20:00.000Z",
    type: "Member assigned to Forum",
    memberId: "mem-031",
    memberName: "Isabel Navarro",
    forumId: "forum-02",
    forumName: "Atlantic Forum",
    detail: "Isabel Navarro is in the final two weeks of the 90-day Forum review window."
  },
  {
    id: "demo-act-002",
    createdAt: "2026-05-08T18:10:00.000Z",
    type: "Forum rejected member",
    memberId: "mem-267",
    memberName: "Marisol Torres",
    forumId: "forum-15",
    forumName: "Bayfront Forum",
    detail: "Bayfront Forum returned Marisol Torres to Free Agents due to a prior business relationship."
  },
  {
    id: "demo-act-003",
    createdAt: "2026-05-07T16:10:00.000Z",
    type: "Intake submitted",
    memberId: "mem-302",
    memberName: "Nico Benitez",
    detail: "Nico Benitez submitted a public intake form for Benitez Logistics Group."
  },
  {
    id: "demo-act-004",
    createdAt: "2026-05-07T16:12:00.000Z",
    type: "Possible duplicate flagged",
    memberId: "mem-301",
    memberName: "Nicolas Benitez",
    detail: "Possible duplicate flagged between Nicolas Benitez and Nico Benitez."
  },
  {
    id: "demo-act-005",
    createdAt: "2026-05-06T13:30:00.000Z",
    type: "Added to shortlist",
    memberId: "mem-224",
    memberName: "Julian Mendoza",
    forumId: "forum-06",
    forumName: "Summit Forum",
    detail: "Julian Mendoza added to Summit Forum shortlist for a one-seat opening."
  },
  {
    id: "demo-act-006",
    createdAt: "2026-05-05T20:00:00.000Z",
    type: "Forum confirmed member",
    memberId: "mem-188",
    memberName: "Evan Espinosa",
    forumId: "forum-24",
    forumName: "Driftwood Forum",
    detail: "Driftwood Forum confirmed Evan Espinosa as In Forum."
  },
  {
    id: "demo-act-007",
    createdAt: "2026-05-04T14:30:00.000Z",
    type: "Intake submitted",
    memberId: "mem-288",
    memberName: "Gabriela Santiago",
    detail: "Gabriela Santiago submitted intake disclosures requiring relationship review."
  },
  {
    id: "demo-act-008",
    createdAt: "2026-05-03T11:00:00.000Z",
    type: "Member imported",
    memberId: "mem-301",
    memberName: "Nicolas Benitez",
    detail: "Nicolas Benitez imported from legacy placement spreadsheet."
  },
  {
    id: "demo-act-009",
    createdAt: "2026-05-02T17:45:00.000Z",
    type: "Relationship review completed",
    memberId: "mem-241",
    memberName: "Natalie Ortega",
    detail: "Relationship review completed for Natalie Ortega."
  },
  {
    id: "demo-act-010",
    createdAt: "2026-05-01T15:00:00.000Z",
    type: "Marked Ready To Assign",
    memberId: "mem-216",
    memberName: "Camila Pereira",
    detail: "Camila Pereira marked Ready To Assign after missing details were resolved."
  }
];

export const getMemberById = (memberId: string) => members.find((member) => member.id === memberId);
export const getForumById = (forumId: string) => forums.find((forum) => forum.id === forumId);
export const getForumMembers = (forum: ForumGroup) => forum.currentMemberIds.map(getMemberById).filter((member): member is Member => Boolean(member));
