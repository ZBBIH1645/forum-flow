"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileWarning,
  GitMerge,
  Hourglass,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound
} from "lucide-react";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { ForumBadge } from "./forum-badge";
import { useLiveData, decisionReasons } from "./live-data-provider";
import { calculateAge } from "@/lib/assignments";
import { daysSinceUpdate, isStaleRecord, meetsRequiredFields, missingRequiredFields } from "@/lib/data-quality";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import type { DataQualityLabel, DecisionReason, Member } from "@/lib/types";

type SectionKey =
  | "missingRevenue"
  | "missingHomeLocation"
  | "missingBusinessLocation"
  | "missingYears"
  | "missingDob"
  | "missingIndustry"
  | "missingRelationshipReview"
  | "missingForumAssignment"
  | "possibleDuplicates"
  | "staleRecords"
  | "readyToAssign"
  | "blockedNeedsReview";

type SectionConfig = {
  key: SectionKey;
  title: string;
  description: string;
  icon: typeof FileWarning;
  match: (member: Member, labels: DataQualityLabel[]) => boolean;
  recommended: string;
};

const SECTIONS: SectionConfig[] = [
  {
    key: "missingRevenue",
    title: "Missing Revenue",
    description: "Members without a revenue range on file.",
    icon: Building2,
    match: (_member, labels) => labels.includes("Missing Revenue"),
    recommended: "Collect revenue range from the member."
  },
  {
    key: "missingHomeLocation",
    title: "Missing Home Location",
    description: "Members without a home location.",
    icon: MapPin,
    match: (_member, labels) => labels.includes("Missing Home Location"),
    recommended: "Confirm home location."
  },
  {
    key: "missingBusinessLocation",
    title: "Missing Business Location",
    description: "Members without a business location.",
    icon: MapPin,
    match: (_member, labels) => labels.includes("Missing Business Location"),
    recommended: "Confirm business location."
  },
  {
    key: "missingYears",
    title: "Missing Years In Business",
    description: "Years-in-business not on file.",
    icon: Clock,
    match: (_member, labels) => labels.includes("Missing Years in Business"),
    recommended: "Capture years in business."
  },
  {
    key: "missingDob",
    title: "Missing DOB",
    description: "Date of birth not on file (age cannot be calculated reliably).",
    icon: ClipboardList,
    match: (_member, labels) => labels.includes("Missing DOB"),
    recommended: "Capture date of birth."
  },
  {
    key: "missingIndustry",
    title: "Missing Industry",
    description: "Industry not on file.",
    icon: Sparkles,
    match: (_member, labels) => labels.includes("Missing Industry"),
    recommended: "Capture industry."
  },
  {
    key: "missingRelationshipReview",
    title: "Missing Relationship / Conflict Review",
    description: "Relationship review has not been marked complete.",
    icon: ShieldAlert,
    match: (_member, labels) => labels.includes("Missing Relationship Review"),
    recommended: "Open profile, confirm conflicts, mark review complete."
  },
  {
    key: "missingForumAssignment",
    title: "Missing Forum Assignment",
    description: "Members without a current Forum or active assignment.",
    icon: UsersRound,
    match: (member) => !member.currentForumId && !member.assignedForumId && member.status !== "Former Member",
    recommended: "Place into a Forum from the Placement Queue or Shortlist Board."
  },
  {
    key: "possibleDuplicates",
    title: "Possible Duplicates",
    description: "Members with unresolved duplicate review cases.",
    icon: GitMerge,
    match: (_member, labels) => labels.includes("Possible Duplicate"),
    recommended: "Open the member profile before making placement changes."
  },
  {
    key: "staleRecords",
    title: "Stale Records",
    description: "Profiles not updated in 6+ months.",
    icon: Clock,
    match: (member) => isStaleRecord(member),
    recommended: "Refresh the profile so placement decisions use current data."
  },
  {
    key: "readyToAssign",
    title: "Ready To Assign",
    description: "Free agents with all required fields and a completed relationship review.",
    icon: CheckCircle2,
    match: (member, labels) => !member.currentForumId && !member.assignedForumId && member.status !== "Former Member" && meetsRequiredFields(labels),
    recommended: "Assign to a Forum from Shortlist Board or Placement Queue."
  },
  {
    key: "blockedNeedsReview",
    title: "Blocked / Needs Review",
    description: "Members with hard conflicts or in a needs-review state.",
    icon: AlertTriangle,
    match: (member, labels) => labels.includes("Has Hard Conflicts") || labels.includes("Needs Review") || member.status === "Needs Conflict Review",
    recommended: "Resolve flagged relationships before assignment."
  }
];

export function DataQualityDashboard() {
  const data = useLiveData();
  const { members } = data;
  const [activeSection, setActiveSection] = useState<SectionKey>("missingRelationshipReview");
  const [includeFormer, setIncludeFormer] = useState(false);
  const [query, setQuery] = useState("");

  const visibleMembers = useMemo(() => members.filter((member) => includeFormer || member.status !== "Former Member"), [includeFormer, members]);

  const memberLabels = useMemo(() => {
    const map = new Map<string, DataQualityLabel[]>();
    for (const member of visibleMembers) {
      map.set(member.id, data.getDataQuality(member));
    }
    return map;
  }, [data, visibleMembers]);

  const counts = useMemo(() => {
    const totals = {
      total: visibleMembers.length,
      complete: 0,
      missingRequired: 0,
      needsRelationshipReview: 0,
      stale: 0,
      readyToAssign: 0,
      assignedPending: 0,
      inForum: 0
    };
    for (const member of visibleMembers) {
      const labels = memberLabels.get(member.id) ?? [];
      if (labels.length === 1 && labels[0] === "Complete") totals.complete += 1;
      if (missingRequiredFields(labels).length > 0) totals.missingRequired += 1;
      if (labels.includes("Missing Relationship Review")) totals.needsRelationshipReview += 1;
      if (labels.includes("Stale Record")) totals.stale += 1;
      if (!member.currentForumId && !member.assignedForumId && meetsRequiredFields(labels)) totals.readyToAssign += 1;
      if (member.assignedForumId) totals.assignedPending += 1;
      if (member.currentForumId) totals.inForum += 1;
    }
    return totals;
  }, [memberLabels, visibleMembers]);

  const sectionMembers = useMemo(() => {
    const config = SECTIONS.find((section) => section.key === activeSection)!;
    return visibleMembers
      .filter((member) => config.match(member, memberLabels.get(member.id) ?? []))
      .filter((member) => matchesSearch(query, [member.name, member.company, member.industry, member.homeLocation, member.businessLocation, member.status, ...(memberLabels.get(member.id) ?? [])]))
      .sort((a, b) => (a.updatedAt && b.updatedAt) ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime() : 0);
  }, [activeSection, memberLabels, query, visibleMembers]);

  const sectionConfig = SECTIONS.find((section) => section.key === activeSection)!;
  const searchTerms = useMemo(() => getSearchableTerms({ members: visibleMembers }), [visibleMembers]);
  const suggestions = useMemo(() => sectionMembers.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [query, searchTerms, sectionMembers.length]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Operations health</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Data Quality</h1>
          <p className="mt-2 text-sm text-muted">Trust the data before assigning members. See what&rsquo;s missing, what&rsquo;s stale, and who&rsquo;s ready to place.</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-card">
          <input
            type="checkbox"
            checked={includeFormer}
            onChange={(event) => setIncludeFormer(event.target.checked)}
            className="h-4 w-4 rounded border-line text-eo-purple"
          />
          Include former members
        </label>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total members" value={counts.total} icon={UsersRound} tone="neutral" />
        <KpiCard label="Complete profiles" value={counts.complete} icon={ShieldCheck} tone="good" />
        <KpiCard label="Missing required info" value={counts.missingRequired} icon={FileWarning} tone="warning" />
        <KpiCard label="Needs relationship review" value={counts.needsRelationshipReview} icon={ShieldAlert} tone="warning" />
        <KpiCard label="Stale records" value={counts.stale} icon={Clock} tone="warning" />
        <KpiCard label="Ready to assign" value={counts.readyToAssign} icon={CheckCircle2} tone="good" />
        <KpiCard label="Assigned / pending" value={counts.assignedPending} icon={Hourglass} tone="indigo" />
        <KpiCard label="In Forum" value={counts.inForum} icon={UserCheck} tone="teal" />
      </div>

      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => {
              const count = visibleMembers.filter((member) => section.match(member, memberLabels.get(member.id) ?? [])).length;
              const active = activeSection === section.key;
              const Icon = section.icon;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    active ? "border-eo-purple bg-eo-purple text-white shadow-card" : "border-line bg-white text-slate-700 hover:border-eo-blue"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {section.title}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-white/20 text-white" : count > 0 ? "bg-eo-purple/10 text-eo-purple" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                </button>
              );
            })}
          </nav>
          <label className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
              placeholder="Search member, company, issue"
              maxLength={inputLimits.search}
              className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10 sm:w-72"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-card">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <sectionConfig.icon className="mt-0.5 h-5 w-5 text-eo-purple" />
          <div>
            <h2 className="text-base font-semibold text-ink">{sectionConfig.title}</h2>
            <p className="mt-1 text-sm text-muted">{sectionConfig.description}</p>
            <p className="mt-2 text-xs font-medium text-eo-purple">Next action: {sectionConfig.recommended}</p>
          </div>
        </div>

        {sectionMembers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-eo-teal" />
            <p className="mt-3 text-sm font-medium text-slate-600">Nothing to clean up here.</p>
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
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {sectionMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                labels={memberLabels.get(member.id) ?? []}
                data={data}
                recommended={sectionConfig.recommended}
              />
            ))}
          </ul>
        )}
      </div>

      <PrivacyNote />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof UsersRound; tone: "good" | "warning" | "neutral" | "teal" | "indigo" }) {
  const accent = tone === "good"
    ? "text-eo-teal"
    : tone === "warning"
    ? "text-amber-700"
    : tone === "teal"
    ? "text-eo-teal"
    : tone === "indigo"
    ? "text-indigo-700"
    : "text-eo-purple";
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <Icon className={`h-4 w-4 ${accent}`} />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function MemberRow({ member, labels, data, recommended }: { member: Member; labels: DataQualityLabel[]; data: ReturnType<typeof useLiveData>; recommended: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);

  const reasonValue = reason ? reason : undefined;
  const missingFields = missingRequiredFields(labels);
  const isReady = !member.currentForumId && !member.assignedForumId && meetsRequiredFields(labels);
  const days = daysSinceUpdate(member);
  const stale = isStaleRecord(member);
  const conflictCount = labels.includes("Has Hard Conflicts") ? "≥1 hard" : labels.includes("Missing Relationship Review") ? "not reviewed" : "reviewed";
  const forum = member.currentForumId
    ? data.getForumById(member.currentForumId)
    : member.assignedForumId
    ? data.getForumById(member.assignedForumId)
    : undefined;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <li className="p-4">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
            <StatusBadge status={data.getEffectiveStatus(member)} />
            {isReady ? <span className="inline-flex items-center rounded-full bg-eo-teal/10 px-2 py-0.5 text-xs font-semibold text-eo-teal">Ready</span> : null}
            {stale ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Stale</span> : null}
          </div>
          <p className="mt-1 text-sm text-slate-700">{member.company || "—"} · {member.industry || "—"}</p>
          <p className="text-xs text-muted">
            {member.dateOfBirth ? `${calculateAge(member)} yrs` : "Age unknown"} · {member.gender} · home {member.homeLocation || "—"} · biz {member.businessLocation || "—"}
          </p>
        </div>

        <div className="space-y-1 text-sm">
          {missingFields.length > 0 ? (
            <p className="text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Missing: {missingFields.join(", ")}</p>
          ) : (
            <p className="text-eo-teal">All required fields present.</p>
          )}
          <p className="text-slate-700">Relationships: {conflictCount}</p>
          {forum ? (
            <div className="flex items-center gap-2 text-xs text-muted">
              Forum:
              <ForumBadge forumId={forum.id} name={forum.name} suffix={member.assignedForumId === forum.id ? "(pending)" : undefined} size="xs" />
            </div>
          ) : (
            <p className="text-xs text-muted">No Forum yet</p>
          )}
          <p className="text-xs text-muted">
            Last updated: {days === null ? "Never" : days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-1.5 lg:items-end">
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
          >
            {open ? "Close" : "Quick actions"}
          </button>
          <Link href={`/members/${member.id}`} className="text-xs font-semibold text-eo-blue">View profile</Link>
          <p className="text-xs text-muted lg:text-right">{recommended}</p>
        </div>
      </div>

      {toast ? <p className="mt-2 text-xs font-semibold text-eo-teal"><CheckCircle2 className="mr-1 inline h-3 w-3" />{toast}</p> : null}

      {open ? (
        <div className="mt-3 rounded-lg border border-line bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as DecisionReason | "")}
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
            >
              <option value="">Reason (optional)</option>
              {decisionReasons.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
            </select>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Decision note"
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link href={`/members/${member.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">View profile</Link>
            <Link href={`/members/${member.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">Edit member</Link>
            <button
              type="button"
              onClick={() => {
                data.updateMemberStatus({ member, status: "Needs Info", note });
                showToast("Marked Needs Info");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
            >
              Mark Needs Info
            </button>
            <button
              type="button"
              onClick={() => {
                data.markRelationshipReviewed({ member, note });
                showToast("Relationship review complete");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-eo-teal/30 bg-eo-teal/10 px-2 py-1 text-xs font-semibold text-eo-teal"
            >
              <ShieldCheck className="h-3 w-3" /> Mark Relationship Reviewed
            </button>
            <button
              type="button"
              onClick={() => {
                data.updateMemberStatus({ member, status: "Needs Conflict Review", note });
                showToast("Marked Needs Conflict Review");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-eo-orange/30 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800"
            >
              Mark Needs Conflict Review
            </button>
            <button
              type="button"
              onClick={() => {
                data.markReadyToAssign({ member, note });
                showToast("Marked Ready To Assign");
                setOpen(false);
              }}
              disabled={!isReady}
              className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-2 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark Ready To Assign
            </button>
            <button
              type="button"
              onClick={() => {
                if (!note.trim()) return;
                data.addDecisionNote({ member, note, reason: reasonValue });
                showToast("Note added");
                setNote("");
                setOpen(false);
              }}
              disabled={!note.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink disabled:opacity-40"
            >
              Add note
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
