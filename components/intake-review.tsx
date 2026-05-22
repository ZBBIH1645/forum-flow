"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Inbox,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus
} from "lucide-react";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { MissingInfoResolutionPanel } from "./missing-info-resolution-panel";
import { useLiveData, decisionReasons } from "./live-data-provider";
import { calculateAge } from "@/lib/assignments";
import { computeDataQualityLabels, daysSinceUpdate, meetsRequiredFields, missingRequiredFields } from "@/lib/data-quality";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import type { DecisionReason, IntakeDisclosures, Member } from "@/lib/types";

type TabKey = "needsReview" | "duplicates" | "readyToAssign" | "all";

const TABS: { key: TabKey; label: string; description: string }[] = [
  { key: "needsReview", label: "Needs review", description: "Intake submissions or new members still in review." },
  { key: "duplicates", label: "Possible duplicates", description: "Submissions matching an existing chapter member." },
  { key: "readyToAssign", label: "Ready to advance", description: "Profiles cleared by data quality and relationship review." },
  { key: "all", label: "All intake records", description: "Every record that came in via the public intake form." }
];

export function IntakeReview() {
  const data = useLiveData();
  const { members, relationships, findPossibleDuplicates } = data;
  const [activeTab, setActiveTab] = useState<TabKey>("needsReview");
  const [query, setQuery] = useState("");

  const intakeMembers = useMemo(() => members.filter((member) => Boolean(member.intakeSubmittedAt) || (member.status === "New Member" && !member.currentForumId && !member.assignedForumId)), [members]);

  const enriched = useMemo(() => intakeMembers.map((member) => {
    const labels = computeDataQualityLabels(member, relationships);
    const missing = missingRequiredFields(labels);
    const ready = !member.currentForumId && !member.assignedForumId && meetsRequiredFields(labels);
    const duplicates = findPossibleDuplicates({ name: member.name, company: member.company, excludeId: member.id });
    return { member, labels, missing, ready, duplicates };
  }), [findPossibleDuplicates, intakeMembers, relationships]);

  const filtered = useMemo(() => {
    const tabRows = (() => {
      switch (activeTab) {
      case "duplicates":
        return enriched.filter((row) => row.duplicates.length > 0);
      case "readyToAssign":
        return enriched.filter((row) => row.ready);
      case "all":
        return enriched;
      case "needsReview":
      default:
        return enriched.filter((row) => !row.ready && row.member.status !== "Former Member");
      }
    })();
    return tabRows.filter((row) => matchesSearch(query, [row.member.name, row.member.company, row.member.industry, row.member.homeLocation, row.member.businessLocation, row.member.status]));
  }, [activeTab, enriched, query]);

  const counts = useMemo(() => ({
    submissions: enriched.length,
    needsReview: enriched.filter((r) => !r.ready && r.member.status !== "Former Member").length,
    duplicates: enriched.filter((r) => r.duplicates.length > 0).length,
    ready: enriched.filter((r) => r.ready).length
  }), [enriched]);

  const tabConfig = TABS.find((t) => t.key === activeTab)!;
  const searchTerms = useMemo(() => getSearchableTerms({ members: intakeMembers }), [intakeMembers]);
  const suggestions = useMemo(() => filtered.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [filtered.length, query, searchTerms]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Intake workflow</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Intake Review</h1>
          <p className="mt-2 text-sm text-muted">Review new public intake submissions before they enter the placement pipeline.</p>
        </div>
        <Link href="/intake" target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">
          <ExternalLink className="h-4 w-4" /> Open member intake form
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Submissions" value={counts.submissions} icon={Inbox} />
        <Stat label="Needs review" value={counts.needsReview} icon={AlertTriangle} tone="warning" />
        <Stat label="Possible duplicates" value={counts.duplicates} icon={UserPlus} tone="warning" />
        <Stat label="Ready to advance" value={counts.ready} icon={Sparkles} tone="good" />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? "border-eo-purple bg-eo-purple text-white shadow-card" : "border-line bg-white text-slate-700 hover:border-eo-blue"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <label className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
            placeholder="Search intake records"
            maxLength={inputLimits.search}
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10 sm:w-72"
          />
        </label>
      </div>

      <div className="rounded-lg border border-line bg-white shadow-card">
        <div className="border-b border-line p-5">
          <h2 className="text-base font-semibold text-ink">{tabConfig.label}</h2>
          <p className="mt-1 text-sm text-muted">{tabConfig.description}</p>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-eo-teal" />
            <p className="mt-3 text-sm font-medium text-slate-600">No intake records in this view.</p>
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
              <p className="mt-1 text-xs text-muted">Public submissions arrive here automatically as soon as they&rsquo;re submitted.</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((row) => (
              <IntakeRow key={row.member.id} row={row} data={data} />
            ))}
          </ul>
        )}
      </div>

      <PrivacyNote />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "neutral" }: { label: string; value: number; icon: typeof Inbox; tone?: "neutral" | "warning" | "good" }) {
  const accent = tone === "warning" ? "text-amber-700" : tone === "good" ? "text-eo-teal" : "text-eo-purple";
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <Icon className={`h-4 w-4 ${accent}`} />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function IntakeRow({ row, data }: { row: { member: Member; missing: string[]; ready: boolean; duplicates: Member[] }; data: ReturnType<typeof useLiveData> }) {
  const { member, missing, ready, duplicates } = row;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);

  const reasonValue = reason ? reason : undefined;
  const days = daysSinceUpdate(member);
  const submittedAt = member.intakeSubmittedAt ? new Date(member.intakeSubmittedAt).toLocaleDateString() : null;
  const reviewedAt = member.relationshipReviewedAt ? new Date(member.relationshipReviewedAt).toLocaleDateString() : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const conflictSummary = member.relationshipReviewCompleted
    ? `Reviewed${reviewedAt ? ` on ${reviewedAt}` : ""}`
    : "Relationship review pending";

  const recommendedAction = ready
    ? "Mark Ready To Assign and place from Placement Queue or Shortlist Board."
    : missing.length > 0
    ? "Collect missing required info."
    : !member.relationshipReviewCompleted
    ? "Confirm relationship review."
    : "Review and decide next step.";

  return (
    <li className="p-5">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/members/${member.id}`} className="text-base font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
            <StatusBadge status={data.getEffectiveStatus(member)} />
            {duplicates.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3 w-3" /> Possible duplicate
              </span>
            ) : null}
            {ready ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-eo-teal/10 px-2 py-0.5 text-xs font-semibold text-eo-teal">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-700">{member.company || "—"} · {member.industry || "—"}</p>
          <p className="text-xs text-muted">
            {member.dateOfBirth ? `${calculateAge(member)} yrs` : "Age unknown"} · {member.gender} · home {member.homeLocation || "—"} · biz {member.businessLocation || "—"} · {member.revenueRange || "—"}
          </p>

          {duplicates.length > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-semibold">Existing record(s) match:</p>
              <ul className="mt-1 space-y-0.5">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    <Link href={`/members/${duplicate.id}`} className="font-semibold text-ink hover:text-eo-blue">{duplicate.name}</Link>
                    <span className="ml-2 text-muted">{duplicate.company || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {member.intakeDisclosures ? (
            <details className="mt-3 rounded-lg border border-line bg-slate-50 p-3 text-sm text-slate-700">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Intake disclosures</summary>
              <DisclosureList disclosures={member.intakeDisclosures} />
            </details>
          ) : null}
        </div>

        <div className="space-y-1 text-sm">
          {missing.length > 0 ? (
            <p className="text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> Missing: {missing.join(", ")}</p>
          ) : (
            <p className="text-eo-teal">All required fields present.</p>
          )}
          <p className="text-slate-700">{conflictSummary}</p>
          <p className="text-xs text-muted">{submittedAt ? `Submitted ${submittedAt}` : "No intake submission timestamp"}</p>
          <p className="text-xs text-muted">{days === null ? "" : days === 0 ? "Updated today" : `Updated ${days} days ago`}</p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-1.5 lg:items-end">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
          >
            {open ? "Close actions" : "Take action"}
          </button>
          <Link href={`/members/${member.id}`} className="text-xs font-semibold text-eo-blue">View profile</Link>
          <p className="text-xs text-muted lg:text-right">{recommendedAction}</p>
        </div>
      </div>

      {toast ? <p className="mt-2 text-xs font-semibold text-eo-teal"><CheckCircle2 className="mr-1 inline h-3 w-3" />{toast}</p> : null}

      {open ? (
        <div className="mt-3 rounded-lg border border-line bg-slate-50 p-3">
          {missing.length > 0 ? <MissingInfoResolutionPanel member={member} compact /> : null}
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
              placeholder="Internal note"
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link href={`/members/${member.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">
              View profile
            </Link>
            <Link href={`/members/${member.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">
              Edit submission
            </Link>
            <button
              type="button"
              onClick={() => {
                data.markIntakeReviewed({ member, note });
                showToast("Marked reviewed");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
            >
              <ClipboardCheck className="h-3 w-3" /> Mark Reviewed
            </button>
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
              disabled={!ready}
              className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-2 py-1 text-xs font-semibold text-white disabled:bg-slate-300"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark Ready To Assign
            </button>
            <button
              type="button"
              onClick={() => {
                data.archiveIntake({ member, note, reason: reasonValue });
                showToast("Intake archived");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
            >
              <Archive className="h-3 w-3" /> Archive / Reject submission
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
              Add internal note
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function DisclosureList({ disclosures }: { disclosures: IntakeDisclosures }) {
  const rows: { label: string; value?: string }[] = [
    { label: "Blood relatives", value: disclosures.bloodRelatives },
    { label: "Spouse", value: disclosures.spouse },
    { label: "Current business partners", value: disclosures.currentBusinessPartners },
    { label: "Former business partners", value: disclosures.formerBusinessPartners },
    { label: "Prior business relationships", value: disclosures.priorBusinessRelationships },
    { label: "Direct competitors", value: disclosures.directCompetitors },
    { label: "Close friends", value: disclosures.closeFriends },
    { label: "Other notes", value: disclosures.otherNotes }
  ];
  const populated = rows.filter((row) => row.value && row.value.trim().length > 0 && row.value.trim().toLowerCase() !== "none");
  if (populated.length === 0) {
    return <p className="mt-2 text-xs text-muted">No disclosures or all responded with “None”.</p>;
  }
  return (
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {populated.map((row) => (
        <div key={row.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</dt>
          <dd className="mt-0.5 text-sm leading-5 text-slate-700">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
