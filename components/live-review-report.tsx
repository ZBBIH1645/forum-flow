"use client";

import { CompatibilityBadge } from "./compatibility-badge";
import { ExportReportButton } from "./export-report-button";
import { ForumBadge } from "./forum-badge";
import { LocalPlacementDecisions } from "./local-placement-decisions";
import { PrivacyNote } from "./privacy-note";
import { useLiveData } from "./live-data-provider";
import { getForumMatchesForMemberFromData } from "@/lib/matching";

export function LiveReviewReport() {
  const { members, forums, relationships, placements, getMemberById, getForumById } = useLiveData();
  const freeAgents = members.filter((member) => !member.currentForumId && !member.assignedForumId && member.status !== "Former Member");
  const proposedPlacements = freeAgents.slice(0, 8).map((member) =>
    getForumMatchesForMemberFromData(member, forums, members, relationships).find((match) => match.label !== "Blocked")
    ?? getForumMatchesForMemberFromData(member, forums, members, relationships)[0]
  ).filter(Boolean);
  const remainingFreeAgents = Math.max(0, freeAgents.length - proposedPlacements.length);
  const conflictsReviewed = proposedPlacements.filter((match) => match.hardBlockers.length > 0 || match.softWarnings.length > 0).length;
  const report = [
    "Forum Placement Review",
    "",
    `Proposed placements: ${proposedPlacements.length}`,
    `Conflicts reviewed: ${conflictsReviewed}`,
    `Remaining free agents: ${remainingFreeAgents}`,
    "",
    ...proposedPlacements.map((match) => [
      `${match.member.name} -> ${match.forum.name}`,
      `Compatibility: ${match.label}`,
      `Why it works: ${match.positiveSignals.join(" ") || match.summary}`,
      `Conflicts reviewed: ${[...match.hardBlockers, ...match.softWarnings].join(" ") || "No blockers or warnings found."}`,
      ""
    ].join("\n"))
  ].join("\n");

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Placement review</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Placement Review</h1>
          <p className="mt-2 text-sm text-muted">A concise internal handoff report from the current member, Forum, and decision data.</p>
        </div>
        <ExportReportButton report={report} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Proposed placements" value={proposedPlacements.length} />
        <Summary label="Conflicts reviewed" value={conflictsReviewed} />
        <Summary label="Remaining free agents" value={remainingFreeAgents} />
      </div>

      <div className="rounded-lg border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">Proposed placements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-slate-50">
              <tr>{["Free agent", "Proposed Forum", "Label", "Why it works", "Concerns"].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {proposedPlacements.map((match) => (
                <tr key={`${match.member.id}-${match.forum.id}`}>
                  <td className="px-4 py-4 text-sm font-semibold text-ink">{match.member.name}</td>
                  <td className="px-4 py-4"><ForumBadge forumId={match.forum.id} name={match.forum.name} href={`/forums/${match.forum.id}`} /></td>
                  <td className="px-4 py-4"><CompatibilityBadge label={match.label} /></td>
                  <td className="px-4 py-4 text-sm text-slate-700">{match.positiveSignals.slice(0, 2).join(" ") || match.summary}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{[...match.hardBlockers, ...match.softWarnings].slice(0, 2).join(" ") || "No blockers or warnings found."}</td>
                </tr>
              ))}
              {proposedPlacements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-ink">No proposed placements available</p>
                    <p className="mt-1 text-sm text-muted">Members assigned for Forum review or already In Forum are excluded from this list.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <LocalPlacementDecisions title="Local placement decisions" />

      <div className="rounded-lg border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-ink">Recent decisions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {placements.slice(0, 6).map((decision) => {
            const member = getMemberById(decision.memberId);
            const forum = getForumById(decision.forumId);
            return (
              <div key={decision.id} className="rounded-lg border border-line bg-slate-50 p-4">
                <p className="text-sm font-semibold text-ink">{decision.status}</p>
                <p className="mt-1 text-sm text-slate-700">{member?.name} {"->"} {forum?.name}</p>
                <p className="mt-2 text-xs leading-5 text-muted">{decision.reason}</p>
              </div>
            );
          })}
        </div>
      </div>

      <PrivacyNote />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
