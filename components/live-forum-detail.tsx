"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Hourglass, UsersRound } from "lucide-react";
import { CompatibilityBadge } from "./compatibility-badge";
import { LocalPlacementDecisions } from "./local-placement-decisions";
import { MatchDecisionButtons } from "./match-decision-buttons";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { useLiveData } from "./live-data-provider";
import { getForumCompositionFromData, getFreeAgentMatchesForForumFromData, getOpenSeats } from "@/lib/matching";
import { calculateAge, getAssignmentDaysLeft } from "@/lib/assignments";

export function LiveForumDetail({ forumId }: { forumId: string }) {
  const { forums, members, relationships, getEffectiveStatus } = useLiveData();
  const forum = forums.find((item) => item.id === forumId);
  if (!forum) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/forums" className="text-sm font-semibold text-eo-blue">Back to Forum groups</Link>
        <p className="mt-4 text-sm text-muted">Forum not found.</p>
      </div>
    );
  }
  const composition = getForumCompositionFromData(forum, members);
  const matches = getFreeAgentMatchesForForumFromData(forum, members, relationships).slice(0, 8);
  const openSeats = getOpenSeats(forum);
  const assignedCandidates = members.filter((member) => member.assignedForumId === forum.id);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/forums" className="text-sm font-semibold text-eo-blue">Back to Forum groups</Link>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{forum.name}</h1>
            <p className="mt-2 text-sm text-muted">{forum.mainLocationZone} · {forum.groupNotes}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${openSeats > 0 ? "bg-eo-teal/10 text-eo-teal" : "bg-slate-100 text-slate-600"}`}>
            {openSeats === 0 ? "Full" : `${openSeats} open ${openSeats === 1 ? "seat" : "seats"}`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={UsersRound} label="Confirmed members" value={`${composition.members.length}/${forum.maxDesiredSize}`} />
        <Metric icon={Hourglass} label="Assigned candidates" value={String(assignedCandidates.length)} />
        <Metric icon={CheckCircle2} label="Forum style" value={forum.forumStyle} />
        <Metric icon={UsersRound} label="Revenue range" value={composition.revenueRange} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-card">
          <h2 className="text-base font-semibold text-ink">Confirmed members</h2>
          <p className="mt-1 text-sm text-muted">{composition.members.length} confirmed member{composition.members.length === 1 ? "" : "s"}. Assigned candidates are shown below and do not count toward this number.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-slate-50">
                <tr>{["Name", "Industry", "Revenue", "Years", "Age", "Gender", "Status"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {composition.members.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3"><Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.industry}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.revenueRange}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.yearsInBusiness}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{calculateAge(member)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.gender}</td>
                    <td className="px-4 py-3"><StatusBadge status={getEffectiveStatus(member)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-card">
          <h2 className="text-base font-semibold text-ink">Composition</h2>
          <div className="mt-4 space-y-3">
            {[
              ["Industries", composition.industries.join(", ") || "N/A"],
              ["Gender mix", Object.entries(composition.genderMix).map(([gender, count]) => `${gender}: ${count}`).join(", ") || "N/A"],
              ["Years in business", composition.yearsRange],
              ["Stage profile", composition.stageProfile || "N/A"],
              ["Expectations", forum.specialExpectations]
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-1 text-sm leading-5 text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {assignedCandidates.length > 0 ? (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Assigned candidates (Pending Forum review)</h2>
              <p className="mt-1 text-sm text-slate-600">These members are assigned to this Forum but are not confirmed members yet. Confirm or reject after Forum review.</p>
            </div>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-800">{assignedCandidates.length} pending</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {assignedCandidates.map((member) => {
              const daysLeft = getAssignmentDaysLeft(member);
              const expired = daysLeft !== null && daysLeft < 0;
              return (
                <div key={member.id} className="rounded-lg border border-indigo-200 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/members/${member.id}`} className="font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
                      <p className="mt-1 text-sm text-slate-700">{member.company} · {member.industry}</p>
                    </div>
                    {daysLeft !== null ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${expired ? "bg-rose-100 text-rose-800" : daysLeft <= 14 ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"}`}>
                        <Clock className="h-3 w-3" />
                        {expired ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted">{calculateAge(member)} yrs · {member.gender} · {member.homeLocation}</p>
                  <p className="mt-1 text-xs text-muted">
                    Start {member.assignmentStartDate ? new Date(member.assignmentStartDate).toLocaleDateString() : "—"} · Expires {member.assignmentExpiresAt ? new Date(member.assignmentExpiresAt).toLocaleDateString() : "—"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-indigo-800">
                    Next action: {expired ? "Return To Free Agent or reassign" : "Confirm / Mark In Forum or Reject / Return To Free Agent"}
                  </p>
                  <MatchDecisionButtons memberId={member.id} memberName={member.name} forumId={forum.id} forumName={forum.name} label="Possible Fit" context="assigned" />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">Best matching free agents for this Forum</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {matches.map((match) => (
            <div key={match.member.id} className="rounded-lg border border-line bg-slate-50 p-4 transition hover:border-eo-blue hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/members/${match.member.id}`} className="font-semibold text-ink hover:text-eo-blue">{match.member.name}</Link>
                  <p className="mt-1 text-sm text-muted">{match.member.company} · {match.member.industry}</p>
                </div>
                <CompatibilityBadge label={match.label} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{match.positiveSignals.slice(0, 2).join(" ") || match.summary}</p>
              {match.hardBlockers.length > 0 || match.softWarnings.length > 0 ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-white p-3 text-sm text-slate-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span>{[...match.hardBlockers, ...match.softWarnings].slice(0, 2).join(" ")}</span>
                </div>
              ) : null}
              <MatchDecisionButtons memberId={match.member.id} memberName={match.member.name} forumId={forum.id} forumName={forum.name} label={match.label} context="free-agent" />
            </div>
          ))}
        </div>
      </div>

      <LocalPlacementDecisions forumId={forum.id} title="Local decisions for this Forum" />
      <PrivacyNote />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <Icon className="h-4 w-4 text-eo-blue" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
