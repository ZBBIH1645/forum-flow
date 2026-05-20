"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, Clipboard, GitMerge, MapPin, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { CompareForums } from "./compare-forums";
import { CompatibilityBadge } from "./compatibility-badge";
import { ForumBadge } from "./forum-badge";
import { MatchDecisionButtons } from "./match-decision-buttons";
import { MemberForm } from "./member-form";
import { PlacementActions } from "./placement-actions";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { relationshipSeverities, relationshipTypes, useLiveData } from "./live-data-provider";
import { getForumMatchesForMemberFromData } from "@/lib/matching";
import { calculateAge, getAssignmentDaysLeft } from "@/lib/assignments";
import { daysSinceUpdate, isStaleRecord, meetsRequiredFields, missingRequiredFields } from "@/lib/data-quality";
import type { MemberRelationship } from "@/lib/types";

export function MemberDetailWorkbench({ memberId }: { memberId: string }) {
  const data = useLiveData();
  const { members, forums, relationships, activity, getMemberById, saveRelationship, getDataQuality, getEffectiveStatus } = data;
  const member = getMemberById(memberId);
  const [relationshipDraft, setRelationshipDraft] = useState({
    relatedMemberId: "",
    type: "Direct competitor" as MemberRelationship["type"],
    severity: "Needs Review" as MemberRelationship["severity"],
    notes: ""
  });
  const [compareForumsOpen, setCompareForumsOpen] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const matches = useMemo(() => member ? getForumMatchesForMemberFromData(member, forums, members, relationships) : [], [forums, member, members, relationships]);
  const eligibleMatches = useMemo(() => {
    if (!member) return [];
    const eligibleForums = forums.filter((forum) => !(member.rejectedForumIds ?? []).includes(forum.id));
    return getForumMatchesForMemberFromData(member, eligibleForums, members, relationships);
  }, [forums, member, members, relationships]);

  if (!member) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/members" className="text-sm font-semibold text-eo-blue">Back to members</Link>
        <p className="mt-4 text-sm text-muted">Member not found.</p>
      </div>
    );
  }

  const bestMatches = eligibleMatches.filter((match) => ["Best Fit", "Good Fit", "Possible Fit"].includes(match.label)).slice(0, 5);
  const reviewMatches = matches.filter((match) => match.label === "Needs Review").slice(0, 4);
  const blockedMatches = matches.filter((match) => match.label === "Blocked").slice(0, 4);
  const placementOptions = eligibleMatches.slice(0, 12).map((match) => ({
    forumId: match.forum.id,
    forumName: match.forum.name,
    label: match.label,
    hardBlockerCount: match.hardBlockers.length,
    warningCount: match.softWarnings.length
  }));
  const memberRelationships = relationships.filter((relationship) => relationship.memberId === member.id || relationship.relatedMemberId === member.id);
  const duplicateCases = data.getDuplicateCasesForMember(member.id);
  const quality = getDataQuality(member);
  const calculatedAge = calculateAge(member);
  const daysLeft = getAssignmentDaysLeft(member);
  const assignedForum = member.assignedForumId ? forums.find((f) => f.id === member.assignedForumId) : undefined;
  const currentForum = member.currentForumId ? forums.find((f) => f.id === member.currentForumId) : undefined;
  const effectiveStatus = getEffectiveStatus(member);
  const primaryForum = currentForum ?? assignedForum;
  const topSuggestedMatch = bestMatches[0] ?? eligibleMatches.find((match) => match.label !== "Blocked");
  const missingLabels = missingRequiredFields(quality);
  const concerns = [
    ...memberRelationships.filter((relationship) => relationship.severity !== "Note Only").map((relationship) => `${relationship.type}: ${relationship.severity}`),
    ...quality.filter((label) => label !== "Complete" && label !== "Stale Record")
  ];
  const nextAction = effectiveStatus === "Assigned / Pending Forum Review" || effectiveStatus === "Assignment Expired"
    ? "Forum must confirm the member as In Forum or reject and return them to Free Agents."
    : missingLabels.length > 0
      ? `Collect missing info: ${missingLabels.join(", ")}.`
      : !member.relationshipReviewCompleted
        ? "Complete relationship review."
        : "Assign to the best-fit Forum or add to a shortlist.";
  const memberActivity = activity.filter((event) => event.memberId === member.id).slice(0, 8);

  const copyMemberSummary = async () => {
    const summary = [
      `Member: ${member.name}`,
      `Company: ${member.company}`,
      `Status: ${effectiveStatus}`,
      `Top suggested Forum: ${topSuggestedMatch?.forum.name ?? "None yet"}`,
      `Why it works: ${topSuggestedMatch?.positiveSignals.slice(0, 2).join(" ") || "Review profile and matches."}`,
      `Concerns: ${concerns.slice(0, 4).join("; ") || "No major concerns recorded."}`,
      `Missing info: ${missingLabels.join(", ") || "None"}`,
      `Current next action: ${nextAction}`
    ].join("\n");
    await navigator.clipboard.writeText(summary);
    setCopyToast("Member summary copied.");
    setTimeout(() => setCopyToast(null), 3000);
  };

  const addRelationship = () => {
    if (!relationshipDraft.relatedMemberId) return;
    saveRelationship({
      memberId: member.id,
      relatedMemberId: relationshipDraft.relatedMemberId,
      type: relationshipDraft.type,
      severity: relationshipDraft.severity,
      notes: relationshipDraft.notes
    });
    setRelationshipDraft({ relatedMemberId: "", type: "Direct competitor", severity: "Needs Review", notes: "" });
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 pb-32">
      <div>
        <Link href="/members" className="text-sm font-semibold text-eo-blue">Back to members</Link>
        <div className="mt-3 rounded-lg border border-line bg-white p-5 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{member.name}</h1>
            <p className="mt-2 text-base font-medium text-slate-700">{member.company} · {member.industry || "Industry missing"}</p>
            <p className="mt-2 text-sm text-muted">
              {primaryForum ? `${currentForum ? "In Forum" : "Assigned"}: ${primaryForum.name}` : "No current Forum assignment"} · Last updated {member.updatedAt ? new Date(member.updatedAt).toLocaleDateString() : "unknown"}
              {member.intakeSubmittedAt ? ` · Intake submitted ${new Date(member.intakeSubmittedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={effectiveStatus} />
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${missingLabels.length === 0 ? "bg-eo-teal/10 text-eo-teal ring-eo-teal/20" : "bg-amber-100 text-amber-900 ring-amber-200"}`}>
              {missingLabels.length === 0 ? "Data complete" : "Needs info"}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${member.relationshipReviewCompleted ? "bg-eo-teal/10 text-eo-teal ring-eo-teal/20" : "bg-eo-orange/15 text-orange-800 ring-eo-orange/20"}`}>
              {member.relationshipReviewCompleted ? "Relationships reviewed" : "Conflict review needed"}
            </span>
            {assignedForum && daysLeft !== null ? (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${daysLeft < 0 ? "bg-rose-100 text-rose-800 ring-rose-200" : daysLeft <= 14 ? "bg-amber-100 text-amber-900 ring-amber-200" : "bg-indigo-100 text-indigo-800 ring-indigo-200"}`}>
                {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left in Forum review`}
              </span>
            ) : null}
          </div>
          </div>
          <div className="mt-4 rounded-lg border border-line bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next best action</p>
            <p className="mt-1 text-sm font-medium text-ink">{nextAction}</p>
            {assignedForum ? <p className="mt-2 text-xs text-muted">Assigned means the member is under Forum review. They are not counted as In Forum until the Forum confirms.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric icon={Building2} label="Revenue" value={member.revenueRange || "Missing"} />
        <Metric icon={Building2} label="Years in business" value={member.yearsInBusiness ? String(member.yearsInBusiness) : "Missing"} />
        <Metric icon={UsersRound} label="Employees" value={String(member.employeeCount || "Missing")} />
        <Metric icon={UsersRound} label="Age / gender" value={`${calculatedAge || "Missing"} · ${member.gender}`} />
        <Metric icon={MapPin} label="Home location" value={member.homeLocation || "Missing"} />
        <Metric icon={MapPin} label="Business location" value={member.businessLocation || "Missing"} />
      </div>

      <DataQualityPanel member={member} qualityLabels={quality} data={data} />

      {duplicateCases.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">Possible duplicate</p>
              <h2 className="mt-1 text-base font-semibold text-ink">{duplicateCases.length} duplicate case{duplicateCases.length === 1 ? "" : "s"} need review</h2>
              <p className="mt-1 text-sm text-slate-700">
                Review before placement changes so activity, relationships, Forum assignment, notes, and intake disclosures are preserved.
              </p>
              <p className="mt-2 text-xs text-amber-900">{duplicateCases[0].reasons.join(", ")} · {duplicateCases[0].confidence}</p>
            </div>
            <Link href="/duplicate-review" className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-950">
              <GitMerge className="h-4 w-4" /> Review before assigning
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 shadow-card">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eo-purple">Compare Forums</p>
          <p className="mt-1 text-sm text-slate-700">See {member.name}&rsquo;s top Forum options side-by-side before assigning.</p>
        </div>
        <button
          type="button"
          onClick={() => setCompareForumsOpen((open) => !open)}
          disabled={eligibleMatches.length < 2}
          className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Scale className="h-4 w-4" />
          {compareForumsOpen ? "Hide comparison" : "Compare top Forums"}
        </button>
      </div>

      {compareForumsOpen ? (
        <CompareForums
          member={member}
          forumIds={eligibleMatches.slice(0, 4).map((match) => match.forum.id)}
          onClose={() => setCompareForumsOpen(false)}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <Panel title="Overview" items={[
            ["Status", effectiveStatus],
            ["Current next action", nextAction],
            ["Data quality", quality.join(", ")],
            ["Relationship review", member.relationshipReviewCompleted ? `Complete${member.relationshipReviewedAt ? ` · ${new Date(member.relationshipReviewedAt).toLocaleDateString()}` : ""}` : "Pending"],
            ["Last updated", member.updatedAt ? new Date(member.updatedAt).toLocaleDateString() : "Unknown"],
            ["Intake submitted", member.intakeSubmittedAt ? new Date(member.intakeSubmittedAt).toLocaleDateString() : "—"]
          ]} />
          <Panel title="Business Details" items={[
            ["Company", member.company],
            ["Industry", member.industry || "Missing"],
            ["Revenue range", member.revenueRange || "Missing"],
            ["Business stage", member.businessStage],
            ["Employees", String(member.employeeCount)],
            ["Years in business", String(member.yearsInBusiness || "Missing")]
          ]} />
          <Panel title="Locations" items={[
            ["Home location", member.homeLocation || "Missing"],
            ["Business location", member.businessLocation || "Missing"]
          ]} />
          <Panel title="Assignment Status" items={[
            ["Current Forum", currentForum?.name ?? "—"],
            ["Assigned Forum", assignedForum?.name ?? "—"],
            ["Assignment start", member.assignmentStartDate ? new Date(member.assignmentStartDate).toLocaleDateString() : "—"],
            ["Assignment expiration", member.assignmentExpiresAt ? new Date(member.assignmentExpiresAt).toLocaleDateString() : "—"],
            ["Days left", daysLeft === null ? "—" : daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days`],
            ["Review note", assignedForum ? "Assigned is not final. Confirm / Mark In Forum is required before this counts as official Forum membership." : "No active Forum review."]
          ]} />
          <Panel title="Notes" items={[
            ["Date of birth", member.dateOfBirth || "Missing"],
            ["Style preference", member.forumStylePreference],
            ["Notes", member.notes || "No additional notes."]
          ]} />
          {member.intakeDisclosures ? (
            <IntakeDisclosurePanel disclosures={member.intakeDisclosures} submittedAt={member.intakeSubmittedAt} />
          ) : null}
          <RelationshipPanel
            memberId={member.id}
            members={members}
            relationships={memberRelationships}
            draft={relationshipDraft}
            setDraft={setRelationshipDraft}
            onSave={addRelationship}
          />
          <ActivityHistoryPanel activity={memberActivity} />
        </div>

        <div className="space-y-5">
          <MatchSection title="Best Forum matches" memberId={member.id} memberName={member.name} matches={bestMatches} context="free-agent" />
          <MatchSection title="Needs Review Forums" memberId={member.id} memberName={member.name} matches={reviewMatches} context="free-agent" />
          <MatchSection title="Blocked Forums" memberId={member.id} memberName={member.name} matches={blockedMatches} context="free-agent" />
        </div>
      </div>

      <PlacementActions memberId={member.id} memberName={member.name} options={placementOptions} />
      <div id="member-form">
        <MemberForm memberId={member.id} />
      </div>
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white/95 p-3 shadow-card backdrop-blur">
        <p className="text-xs font-semibold text-muted">{copyToast ?? "Profile actions"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyMemberSummary} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
            <Clipboard className="h-3.5 w-3.5" /> Copy Member Summary
          </button>
          <a href="#member-form" className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">Edit Details</a>
        </div>
      </div>
      <PrivacyNote />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <Icon className="h-4 w-4 text-eo-blue" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function DataQualityPanel({ member, qualityLabels, data }: { member: import("@/lib/types").Member; qualityLabels: import("@/lib/types").DataQualityLabel[]; data: ReturnType<typeof useLiveData> }) {
  const missing = missingRequiredFields(qualityLabels);
  const ready = meetsRequiredFields(qualityLabels);
  const stale = isStaleRecord(member);
  const days = daysSinceUpdate(member);
  const reviewedAt = member.relationshipReviewedAt ? new Date(member.relationshipReviewedAt).toLocaleDateString() : null;
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eo-purple">Data Quality</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {ready ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-eo-teal/10 px-2.5 py-1 text-xs font-semibold text-eo-teal"><CheckCircle2 className="h-3 w-3" /> Ready to assign</span>
            ) : missing.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" /> Missing required info</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Needs review</span>
            )}
            {stale ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Stale record</span> : null}
            {member.relationshipReviewCompleted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-eo-teal/10 px-2 py-0.5 text-xs font-semibold text-eo-teal"><ShieldCheck className="h-3 w-3" /> Relationship reviewed{reviewedAt ? ` · ${reviewedAt}` : ""}</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-eo-orange/15 px-2 py-0.5 text-xs font-semibold text-orange-800">Relationship review pending</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            Last updated: {days === null ? "Never" : days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`}{member.updatedAt ? ` (${new Date(member.updatedAt).toLocaleDateString()})` : ""}.
          </p>
          {missing.length > 0 ? (
            <p className="mt-1 text-sm text-amber-800"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Missing: {missing.join(", ")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!member.relationshipReviewCompleted ? (
            <button
              type="button"
              onClick={() => {
                data.markRelationshipReviewed({ member });
                showToast("Relationship review marked complete");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-eo-teal/30 bg-eo-teal/10 px-3 py-2 text-xs font-semibold text-eo-teal"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Mark Relationship Reviewed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              data.markReadyToAssign({ member });
              showToast("Marked Ready To Assign");
            }}
            disabled={!ready || Boolean(member.currentForumId) || Boolean(member.assignedForumId)}
            className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready To Assign
          </button>
          <button
            type="button"
            onClick={() => {
              data.updateMemberStatus({ member, status: "Needs Info" });
              showToast("Marked Needs Info");
            }}
            disabled={Boolean(member.currentForumId)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-40"
          >
            Mark Needs Info
          </button>
          <button
            type="button"
            onClick={() => {
              data.updateMemberStatus({ member, status: "Needs Conflict Review" });
              showToast("Marked Needs Conflict Review");
            }}
            disabled={Boolean(member.currentForumId)}
            className="inline-flex items-center gap-1 rounded-lg border border-eo-orange/30 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 disabled:opacity-40"
          >
            Mark Needs Conflict Review
          </button>
        </div>
      </div>
      {toast ? <p className="mt-3 text-xs font-semibold text-eo-teal"><CheckCircle2 className="mr-1 inline h-3 w-3" />{toast}</p> : null}
    </div>
  );
}

function IntakeDisclosurePanel({ disclosures, submittedAt }: { disclosures: import("@/lib/types").IntakeDisclosures; submittedAt?: string }) {
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

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Intake disclosures</h2>
        {submittedAt ? <span className="text-xs text-muted">Submitted {new Date(submittedAt).toLocaleDateString()}</span> : null}
      </div>
      {populated.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No disclosures or all responded with “None”.</p>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {populated.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{row.label}</dt>
              <dd className="mt-1 text-sm leading-5 text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Panel({ title, items }: { title: string; items: string[][] }) {
  return (
    <details open className="rounded-lg border border-line bg-white p-5 shadow-card">
      <summary className="cursor-pointer text-base font-semibold text-ink">{title}</summary>
      <div className="mt-4 space-y-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-sm leading-5 text-ink">{value}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ActivityHistoryPanel({ activity }: { activity: ReturnType<typeof useLiveData>["activity"] }) {
  return (
    <details open className="rounded-lg border border-line bg-white p-5 shadow-card">
      <summary className="cursor-pointer text-base font-semibold text-ink">Activity History</summary>
      <div className="mt-4 space-y-3">
        {activity.length === 0 ? <p className="text-sm text-muted">No activity recorded for this member yet.</p> : null}
        {activity.map((event) => (
          <div key={event.id} className="rounded-lg border border-line bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{event.type}</p>
              <p className="text-xs text-muted">{new Date(event.createdAt).toLocaleDateString()}</p>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-700">{event.detail}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function RelationshipPanel({
  memberId,
  members,
  relationships,
  draft,
  setDraft,
  onSave
}: {
  memberId: string;
  members: { id: string; name: string; company: string }[];
  relationships: MemberRelationship[];
  draft: Omit<MemberRelationship, "id" | "memberId">;
  setDraft: (draft: Omit<MemberRelationship, "id" | "memberId">) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">Relationships and conflicts</h2>
      <div className="mt-4 space-y-3">
        {relationships.length === 0 ? <p className="text-sm text-muted">No relationships or conflicts recorded.</p> : null}
        {relationships.map((relationship) => {
          const relatedId = relationship.memberId === memberId ? relationship.relatedMemberId : relationship.memberId;
          const related = members.find((member) => member.id === relatedId);
          return (
            <div key={relationship.id} className="rounded-lg border border-line bg-slate-50 p-3">
              <p className="text-sm font-semibold text-ink">{related?.name ?? relatedId}</p>
              <p className="mt-1 text-sm text-slate-700">{relationship.type} · {relationship.severity}</p>
              {relationship.notes ? <p className="mt-1 text-xs text-muted">{relationship.notes}</p> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3">
        <select value={draft.relatedMemberId} onChange={(event) => setDraft({ ...draft, relatedMemberId: event.target.value })} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink">
          <option value="">Related member</option>
          {members.filter((member) => member.id !== memberId).slice(0, 80).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.company}</option>)}
        </select>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as MemberRelationship["type"] })} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink">
            {relationshipTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as MemberRelationship["severity"] })} className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink">
            {relationshipSeverities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
          </select>
        </div>
        <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} placeholder="Notes" className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
        <button onClick={onSave} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Add relationship</button>
      </div>
    </div>
  );
}

function MatchSection({ title, memberId, memberName, matches, context }: { title: string; memberId: string; memberName: string; matches: ReturnType<typeof getForumMatchesForMemberFromData>; context: "free-agent" | "assigned" }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-3">
        {matches.length === 0 ? <p className="text-sm text-muted">No Forums in this category.</p> : null}
        {matches.map((match) => {
          const cardStatus = match.label === "Blocked" ? "Blocked" : match.label === "Needs Review" ? "Needs Review" : "Ready";
          return (
            <div key={match.forum.id} className="rounded-lg border border-line bg-slate-50 p-4 transition hover:border-eo-blue hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <ForumBadge forumId={match.forum.id} name={match.forum.name} href={`/forums/${match.forum.id}`} />
                  <p className="mt-1 text-sm text-muted">{match.forum.mainLocationZone} · {match.forum.forumStyle}</p>
                </div>
                <CompatibilityBadge label={match.label} />
              </div>
              <CardSection title="Why This Works" items={match.positiveSignals} emptyText="No specific positive signals identified yet." tone="positive" />
              {match.softWarnings.length > 0 ? (
                <CardSection title="Concerns" items={match.softWarnings} tone="warning" />
              ) : null}
              {match.hardBlockers.length > 0 ? (
                <CardSection title="Blockers" items={match.hardBlockers} tone="blocker" />
              ) : null}
              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${cardStatus === "Blocked" ? "bg-red-50 text-red-700" : cardStatus === "Needs Review" ? "bg-amber-100 text-amber-900" : "bg-eo-teal/10 text-eo-teal"}`}>
                  Status: {cardStatus}
                </span>
              </div>
              <MatchDecisionButtons memberId={memberId} memberName={memberName} forumId={match.forum.id} forumName={match.forum.name} label={match.label} context={context} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardSection({ title, items, emptyText, tone }: { title: string; items: string[]; emptyText?: string; tone: "positive" | "warning" | "blocker" }) {
  const toneClass = tone === "positive" ? "text-eo-teal" : tone === "warning" ? "text-amber-900" : "text-red-700";
  const Icon = tone === "blocker" || tone === "warning" ? AlertTriangle : null;
  if (items.length === 0 && !emptyText) return null;
  return (
    <div className="mt-3 rounded-lg bg-white p-3 text-sm">
      <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.slice(0, 3).map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
              {Icon ? <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" /> : null}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
