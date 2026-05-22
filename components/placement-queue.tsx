"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Hourglass,
  Inbox,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import { CompatibilityBadge } from "./compatibility-badge";
import { ConflictSummaryPanel } from "./conflict-summary-panel";
import { MissingInfoResolutionPanel } from "./missing-info-resolution-panel";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { useLiveData, decisionReasons, isMemberReadyToAssign } from "./live-data-provider";
import { getForumMatchesForMemberFromData } from "@/lib/matching";
import {
  calculateAge,
  getAssignmentDaysLeft,
  isAssignmentExpired,
  isAssignmentExpiringSoon
} from "@/lib/assignments";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import { missingRequiredFields } from "@/lib/data-quality";
import { buildMemberFlags, summarizeConflicts } from "@/lib/member-insights";
import type { CompatibilityReview, DecisionReason, ForumGroup, Member } from "@/lib/types";
import { ForumBadge } from "./forum-badge";

type SectionKey =
  | "needsInfo"
  | "needsConflictReview"
  | "readyToAssign"
  | "shortlisted"
  | "assignedPending"
  | "expiringSoon"
  | "expired"
  | "recentlyConfirmed"
  | "recentlyRejected";

type SectionConfig = {
  key: SectionKey;
  title: string;
  description: string;
  icon: typeof Inbox;
  tone: string;
};

const SECTIONS: SectionConfig[] = [
  {
    key: "needsInfo",
    title: "Needs Info",
    description: "Members missing required placement information.",
    icon: Inbox,
    tone: "border-amber-200 bg-amber-50"
  },
  {
    key: "needsConflictReview",
    title: "Needs Conflict Review",
    description: "Relationship or competitor flags require a closer look before assignment.",
    icon: ShieldAlert,
    tone: "border-eo-orange/30 bg-orange-50"
  },
  {
    key: "readyToAssign",
    title: "Ready To Assign",
    description: "Free agents with complete data and a clear top Forum suggestion.",
    icon: Sparkles,
    tone: "border-eo-blue/20 bg-eo-blue/5"
  },
  {
    key: "shortlisted",
    title: "Shortlisted",
    description: "Members shortlisted for upcoming review by the placement chair.",
    icon: ClipboardList,
    tone: "border-eo-pink/20 bg-eo-pink/5"
  },
  {
    key: "assignedPending",
    title: "Assigned / Pending Forum Review",
    description: "Assigned to a Forum and waiting on the Forum's decision.",
    icon: Hourglass,
    tone: "border-indigo-200 bg-indigo-50"
  },
  {
    key: "expiringSoon",
    title: "Assignment Expiring Soon",
    description: "Less than 14 days left in the 90-day Forum review window.",
    icon: Clock,
    tone: "border-amber-200 bg-amber-50"
  },
  {
    key: "expired",
    title: "Assignment Expired",
    description: "The 90-day window passed without confirmation. Reassign or return to Free Agents.",
    icon: AlertTriangle,
    tone: "border-rose-200 bg-rose-50"
  },
  {
    key: "recentlyConfirmed",
    title: "Recently Confirmed In Forum",
    description: "Confirmed Forum members from the last 30 days.",
    icon: UserCheck,
    tone: "border-eo-teal/20 bg-eo-teal/5"
  },
  {
    key: "recentlyRejected",
    title: "Recently Rejected",
    description: "Forums that recently declined an assigned candidate.",
    icon: UserX,
    tone: "border-red-200 bg-red-50"
  }
];

const isWithinDays = (iso: string | undefined, days: number) => {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= days * 24 * 60 * 60 * 1000;
};

export function PlacementQueue() {
  const data = useLiveData();
  const { members, forums, relationships, localPlacements, getDataQuality } = data;
  const [activeSection, setActiveSection] = useState<SectionKey>("readyToAssign");
  const [query, setQuery] = useState("");

  const sections = useMemo(() => buildSections(members, forums, relationships, localPlacements, getDataQuality), [members, forums, relationships, localPlacements, getDataQuality]);
  const visibleSections = useMemo(() => {
    const next = {} as Sections;
    for (const section of SECTIONS) {
      next[section.key] = sections[section.key].filter((row) =>
        matchesSearch(query, [
          row.member.name,
          row.member.company,
          row.member.industry,
          row.member.homeLocation,
          row.member.businessLocation,
          row.member.status,
          row.assignedForum?.name,
          row.topMatch?.forum.name,
          row.recommendedAction
        ])
      );
    }
    return next;
  }, [query, sections]);
  const counts = useMemo(() => Object.fromEntries(SECTIONS.map((section) => [section.key, visibleSections[section.key].length])) as Record<SectionKey, number>, [visibleSections]);
  const searchTerms = useMemo(() => getSearchableTerms({ members, forums }), [forums, members]);

  const totalActionable = counts.needsInfo + counts.needsConflictReview + counts.readyToAssign + counts.shortlisted + counts.expiringSoon + counts.expired;

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Daily workbench</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Placement Queue</h1>
          <p className="mt-2 text-sm text-muted">Your daily command center for moving members through the Forum placement workflow.</p>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open work</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{totalActionable}</p>
          <p className="text-xs text-muted">members need attention right now</p>
        </div>
      </header>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
            placeholder="Search queue by member, company, Forum, status"
            maxLength={inputLimits.search}
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          />
        </label>
      </div>

      <nav className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.key;
          const count = counts[section.key];
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => setActiveSection(section.key)}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition shadow-card ${
                active ? "border-eo-purple bg-white ring-2 ring-eo-purple/20" : `${section.tone} hover:border-eo-purple/40`
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 text-eo-purple" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{section.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${count > 0 ? "bg-eo-purple text-white" : "bg-slate-200 text-slate-600"}`}>{count}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{section.description}</p>
              </div>
            </button>
          );
        })}
      </nav>

      <SectionView sectionKey={activeSection} sections={visibleSections} data={data} query={query} setQuery={setQuery} searchTerms={searchTerms} />

      <PrivacyNote />
    </div>
  );
}

type Sections = Record<SectionKey, QueueRow[]>;

type QueueRow = {
  member: Member;
  topMatch?: CompatibilityReview;
  assignedForum?: ForumGroup;
  daysLeft: number | null;
  conflictCount: number;
  missingFields: string[];
  recommendedAction: string;
  noteForSection?: string;
};

const buildSections = (
  members: Member[],
  forums: ForumGroup[],
  relationships: ReturnType<typeof useLiveData>["relationships"],
  localPlacements: ReturnType<typeof useLiveData>["localPlacements"],
  getDataQuality: ReturnType<typeof useLiveData>["getDataQuality"]
): Sections => {
  const sections: Sections = {
    needsInfo: [],
    needsConflictReview: [],
    readyToAssign: [],
    shortlisted: [],
    assignedPending: [],
    expiringSoon: [],
    expired: [],
    recentlyConfirmed: [],
    recentlyRejected: []
  };

  const matchFor = (member: Member): CompatibilityReview | undefined => {
    if (member.currentForumId) return undefined;
    const eligibleForums = forums.filter((forum) => !(member.rejectedForumIds ?? []).includes(forum.id));
    const matches = getForumMatchesForMemberFromData(member, eligibleForums, members, relationships);
    return matches.find((match) => match.label !== "Blocked") ?? matches[0];
  };

  for (const member of members) {
    const conflictCount = relationships.filter((r) => r.memberId === member.id || r.relatedMemberId === member.id).length;
    const quality = getDataQuality(member);
    const missingFields = missingRequiredFields(quality);

    if (member.status === "In Forum" || member.status === "Placed") continue;
    if (member.status === "Former Member") continue;

    const assignedForum = member.assignedForumId ? forums.find((f) => f.id === member.assignedForumId) : undefined;
    const daysLeft = getAssignmentDaysLeft(member);

    const baseRow: QueueRow = {
      member,
      topMatch: matchFor(member),
      assignedForum,
      daysLeft,
      conflictCount,
      missingFields,
      recommendedAction: "Open profile"
    };

    if (member.status === "Assigned / Pending Forum Review" && assignedForum) {
      const expired = isAssignmentExpired(member);
      if (expired) {
        sections.expired.push({ ...baseRow, recommendedAction: "Return to Free Agents or reassign" });
      } else if (isAssignmentExpiringSoon(member)) {
        sections.expiringSoon.push({ ...baseRow, recommendedAction: "Follow up with Forum" });
      } else {
        sections.assignedPending.push({ ...baseRow, recommendedAction: "Awaiting Forum decision" });
      }
      continue;
    }

    if (member.status === "Assignment Expired" && assignedForum) {
      sections.expired.push({ ...baseRow, recommendedAction: "Return to Free Agents or reassign" });
      continue;
    }

    if (
      member.status === "Needs Info" ||
      quality.includes("Missing Home Location") ||
      quality.includes("Missing Business Location") ||
      quality.includes("Missing Revenue") ||
      quality.includes("Missing Years in Business") ||
      quality.includes("Missing DOB") ||
      quality.includes("Missing Industry")
    ) {
      sections.needsInfo.push({ ...baseRow, recommendedAction: "Collect missing info" });
      continue;
    }

    if (member.status === "Needs Conflict Review" || quality.includes("Missing Relationship Review") || quality.includes("Has Hard Conflicts")) {
      sections.needsConflictReview.push({ ...baseRow, recommendedAction: "Review conflicts and disclosures" });
      continue;
    }

    if (member.status === "Shortlisted") {
      sections.shortlisted.push({ ...baseRow, recommendedAction: "Confirm or assign to top Forum" });
      continue;
    }

    if ((member.status === "Free Agent" || member.status === "Ready To Assign" || member.status === "New Member" || member.status === "Rejected") && isMemberReadyToAssign(quality)) {
      sections.readyToAssign.push({ ...baseRow, recommendedAction: "Assign to top Forum" });
      continue;
    }
  }

  // Recently Confirmed / Recently Rejected from local placement decisions (last 30 days).
  for (const placement of localPlacements) {
    if (!isWithinDays(placement.createdAt, 30)) continue;
    const member = members.find((m) => m.id === placement.memberId);
    if (!member) continue;
    const forum = forums.find((f) => f.id === placement.forumId);
    if (!forum) continue;
    const conflictCount = relationships.filter((r) => r.memberId === member.id || r.relatedMemberId === member.id).length;
    const quality = getDataQuality(member);

    const row: QueueRow = {
      member,
      topMatch: undefined,
      assignedForum: forum,
      daysLeft: getAssignmentDaysLeft(member),
      conflictCount,
      missingFields: missingRequiredFields(quality),
      recommendedAction: "Review",
      noteForSection: placement.note || placement.reason
    };

    if (placement.status === "Confirmed" || placement.status === "Approved" || placement.status === "Placed") {
      if (!sections.recentlyConfirmed.find((r) => r.member.id === member.id)) {
        sections.recentlyConfirmed.push({ ...row, recommendedAction: "Confirmed in Forum" });
      }
    } else if (placement.status === "Rejected" || placement.status === "Returned") {
      if (!sections.recentlyRejected.find((r) => r.member.id === member.id)) {
        sections.recentlyRejected.push({ ...row, recommendedAction: "Returned to Free Agent pool" });
      }
    }
  }

  return sections;
};

function SectionView({
  sectionKey,
  sections,
  data,
  query,
  setQuery,
  searchTerms
}: {
  sectionKey: SectionKey;
  sections: Sections;
  data: ReturnType<typeof useLiveData>;
  query: string;
  setQuery: (query: string) => void;
  searchTerms: string[];
}) {
  const config = SECTIONS.find((section) => section.key === sectionKey)!;
  const rows = sections[sectionKey];
  const Icon = config.icon;
  const suggestions = useMemo(() => rows.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [query, rows.length, searchTerms]);

  return (
    <div className="rounded-lg border border-line bg-white shadow-card">
      <div className="flex flex-col gap-2 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className="mt-1 h-5 w-5 text-eo-purple" />
          <div>
            <h2 className="text-lg font-semibold text-ink">{config.title}</h2>
            <p className="mt-1 text-sm text-muted">{config.description}</p>
          </div>
        </div>
        <span className="inline-flex h-8 items-center rounded-full bg-eo-purple/10 px-3 text-sm font-semibold text-eo-purple">
          {rows.length} {rows.length === 1 ? "member" : "members"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">Nothing in this section right now.</p>
          {suggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
              <span>Did you mean</span>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="font-semibold text-eo-blue hover:text-eo-purple">
                  {suggestion}
                </button>
              ))}
              <span>?</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">As work moves through the queue, members will appear here.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((row) => (
            <QueueRowCard key={`${sectionKey}-${row.member.id}`} sectionKey={sectionKey} row={row} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRowCard({ sectionKey, row, data }: { sectionKey: SectionKey; row: QueueRow; data: ReturnType<typeof useLiveData> }) {
  const { member, topMatch, assignedForum, daysLeft, conflictCount, missingFields, recommendedAction, noteForSection } = row;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedForumId, setSelectedForumId] = useState<string>(topMatch?.forum.id ?? "");

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const reasonValue = reason ? reason : undefined;

  const handleAssign = () => {
    if (missingFields.length > 0 && !note.trim()) {
      showToast("This member is missing required info. Add a decision note to override.");
      return;
    }
    const forumId = selectedForumId || topMatch?.forum.id;
    if (!forumId) return;
    const forum = data.getForumById(forumId);
    if (!forum) return;
    data.assignToForum({ member, forum, note, reason: reasonValue });
    showToast(`${member.name} assigned to ${forum.name}.`);
    setOpen(false);
    setNote("");
    setReason("");
  };

  const handleConfirm = () => {
    if (!assignedForum) return;
    data.confirmInForum({ member, forum: assignedForum, note, reason: reasonValue });
    showToast(`${member.name} confirmed in ${assignedForum.name}.`);
    setOpen(false);
  };

  const handleReject = () => {
    if (!assignedForum) return;
    data.rejectAssignment({ member, forum: assignedForum, note, reason: reasonValue });
    showToast(`${member.name} returned to Free Agents.`);
    setOpen(false);
  };

  const handleReturnToFreeAgent = () => {
    data.returnToFreeAgent({ member, note, reason: reasonValue });
    showToast(`${member.name} returned to Free Agents.`);
    setOpen(false);
  };

  const handleShortlist = () => {
    if (!topMatch) return;
    data.recordPlacementDecision({ member, forum: topMatch.forum, status: "Shortlisted", note });
    showToast(`${member.name} shortlisted for ${topMatch.forum.name}.`);
    setOpen(false);
  };

  const handleMarkNeedsInfo = () => {
    data.updateMemberStatus({ member, status: "Needs Info", note });
    showToast(`${member.name} marked as Needs Info.`);
    setOpen(false);
  };

  const handleMarkNeedsConflictReview = () => {
    data.updateMemberStatus({ member, status: "Needs Conflict Review", note });
    showToast(`${member.name} marked for Conflict Review.`);
    setOpen(false);
  };

  const age = calculateAge(member);
  const isAssignedSection = sectionKey === "assignedPending" || sectionKey === "expiringSoon" || sectionKey === "expired";
  const isFreeAgentLikeSection = sectionKey === "needsInfo" || sectionKey === "needsConflictReview" || sectionKey === "readyToAssign" || sectionKey === "shortlisted";
  const flags = buildMemberFlags(member, data.getDataQuality(member));
  const conflictSummary = summarizeConflicts(member, data.relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id), data.members, data.forums);

  return (
    <div className="flex flex-col gap-4 p-5">
      {toast ? (
        <div className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-3 text-sm font-medium text-eo-teal">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />{toast}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/members/${member.id}`} className="text-base font-semibold text-ink hover:text-eo-blue">
              {member.name}
            </Link>
            <StatusBadge status={data.getEffectiveStatus(member)} />
            {topMatch ? <CompatibilityBadge label={topMatch.label} /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-700">{member.company} · {member.industry}</p>
          <p className="mt-1 text-xs text-muted">{age ? `${age} yrs` : "Age unknown"} · {member.gender} · {member.homeLocation || "Location missing"}</p>
          {noteForSection ? <p className="mt-2 text-xs text-muted">Decision note: {noteForSection}</p> : null}
        </div>

        <div className="space-y-1 text-sm">
          {missingFields.length > 0 ? (
            <p className="text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {flags[0]?.label ?? "Needs Info"}: {missingFields.join(", ")}</p>
          ) : (
            <p className="text-slate-600">Data quality: Complete</p>
          )}
          {conflictCount > 0 ? <p className="text-orange-700">{conflictSummary.summary}</p> : null}
          {assignedForum ? (
            <p className="flex items-center gap-2 text-indigo-700">Assigned to <ForumBadge forumId={assignedForum.id} name={assignedForum.name} size="xs" /></p>
          ) : topMatch ? (
            <p className="flex items-center gap-2 text-slate-700">Top suggested: <ForumBadge forumId={topMatch.forum.id} name={topMatch.forum.name} size="xs" /></p>
          ) : null}
          {daysLeft !== null ? (
            <DaysLeftIndicator daysLeft={daysLeft} />
          ) : null}
          {assignedForum ? (
            <p className="text-xs text-muted">
              Start {member.assignmentStartDate ? new Date(member.assignmentStartDate).toLocaleDateString() : "—"} · Expires {member.assignmentExpiresAt ? new Date(member.assignmentExpiresAt).toLocaleDateString() : "—"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            {open ? "Close actions" : "Take action"}
            <ChevronRight className={`h-4 w-4 transition ${open ? "rotate-90" : ""}`} />
          </button>
          <Link href={`/members/${member.id}`} className="text-xs font-semibold text-eo-blue">
            View profile
          </Link>
          <p className="text-xs text-muted lg:text-right">{recommendedAction}</p>
        </div>
      </div>

      {open ? (
        <div className="rounded-lg border border-line bg-slate-50 p-4">
          {missingFields.length > 0 ? <MissingInfoResolutionPanel member={member} compact /> : null}
          <ConflictSummaryPanel member={member} compact />
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Reason</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as DecisionReason | "")}
                className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
              >
                <option value="">Choose a reason (optional)</option>
                {decisionReasons.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
              </select>
            </label>
            {isFreeAgentLikeSection ? (
              <label>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Forum</span>
                <select
                  value={selectedForumId}
                  onChange={(event) => setSelectedForumId(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
                >
                  {topMatch ? (
                    <option value={topMatch.forum.id}>{topMatch.forum.name} (Top — {topMatch.label})</option>
                  ) : null}
                  {data.forums
                    .filter((forum) => forum.id !== topMatch?.forum.id)
                    .filter((forum) => !(member.rejectedForumIds ?? []).includes(forum.id))
                    .map((forum) => (
                      <option key={forum.id} value={forum.id}>{forum.name}</option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>

          <label className="mt-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Decision note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder="Optional context for this action"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            {isFreeAgentLikeSection ? (
              <>
                <button onClick={handleAssign} disabled={!selectedForumId && !topMatch} className="rounded-lg bg-eo-purple px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                  Assign to Forum
                </button>
                <button onClick={handleShortlist} disabled={!topMatch} className="rounded-lg border border-eo-pink/30 bg-eo-pink/10 px-4 py-2 text-sm font-semibold text-eo-pink disabled:bg-slate-100 disabled:text-slate-400">
                  Shortlist
                </button>
                <button onClick={handleMarkNeedsInfo} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
                  Mark Needs Info
                </button>
                <button onClick={handleMarkNeedsConflictReview} className="rounded-lg border border-eo-orange/30 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800">
                  Mark Needs Conflict Review
                </button>
              </>
            ) : null}

            {isAssignedSection ? (
              <>
                <button onClick={handleConfirm} className="rounded-lg bg-eo-teal px-4 py-2 text-sm font-semibold text-white">
                  Confirm / Mark In Forum
                </button>
                <button onClick={handleReject} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                  Reject / Return To Free Agent
                </button>
                {sectionKey === "expired" ? (
                  <button onClick={handleReturnToFreeAgent} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
                    Return To Free Agent
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DaysLeftIndicator({ daysLeft }: { daysLeft: number }) {
  let tone = "bg-eo-teal/10 text-eo-teal";
  let label = `${daysLeft} days left`;
  if (daysLeft < 0) {
    tone = "bg-rose-100 text-rose-800";
    label = `Expired ${Math.abs(daysLeft)} days ago`;
  } else if (daysLeft <= 14) {
    tone = "bg-amber-100 text-amber-900";
  } else if (daysLeft <= 30) {
    tone = "bg-eo-blue/10 text-eo-blue";
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}
