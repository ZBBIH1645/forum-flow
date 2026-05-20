"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clipboard, Download, FileText, Network, Printer, UsersRound, type LucideIcon } from "lucide-react";
import { PrivacyNote } from "./privacy-note";
import { StatCard } from "./stat-card";
import { StatusBadge } from "./status-badge";
import { ForumBadge } from "./forum-badge";
import { useLiveData } from "./live-data-provider";
import {
  buildAssignmentPipeline,
  buildExecutiveCounts,
  buildForumCapacity,
  recentReportActivity,
  type AssignmentPipelineStatus
} from "@/lib/reports";
import type { DataQualityLabel } from "@/lib/types";

const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString() : "—";

const toCsv = (rows: unknown[][]) =>
  rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");

const downloadCsv = (filename: string, rows: unknown[][]) => {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export function ReportsPage() {
  const data = useLiveData();
  const { members, forums, relationships, duplicateCases, localPlacements, activity } = data;
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(() => buildExecutiveCounts(members, relationships, duplicateCases), [members, relationships, duplicateCases]);
  const pipeline = useMemo(() => buildAssignmentPipeline(members, forums, localPlacements), [forums, localPlacements, members]);
  const capacity = useMemo(() => buildForumCapacity(forums, members, localPlacements), [forums, localPlacements, members]);
  const recentActivity = useMemo(() => recentReportActivity(activity), [activity]);

  const qualityPreview = useMemo(() => {
    const rows = members.filter((member) => member.status !== "Former Member").map((member) => ({
      member,
      labels: data.getDataQuality(member)
    }));
    const byLabel = (label: DataQualityLabel) => rows.filter((row) => row.labels.includes(label)).map((row) => row.member).slice(0, 5);
    return [
      ["Missing revenue", byLabel("Missing Revenue")],
      ["Missing home location", byLabel("Missing Home Location")],
      ["Missing business location", byLabel("Missing Business Location")],
      ["Missing years in business", byLabel("Missing Years in Business")],
      ["Missing DOB", byLabel("Missing DOB")],
      ["Missing industry", byLabel("Missing Industry")],
      ["Missing relationship review", byLabel("Missing Relationship Review")],
      ["Hard conflicts", byLabel("Has Hard Conflicts")],
      ["Stale records", rows.filter((row) => row.labels.includes("Stale Record")).map((row) => row.member).slice(0, 5)],
      ["Possible duplicates", rows.filter((row) => row.labels.includes("Possible Duplicate")).map((row) => row.member).slice(0, 5)]
    ] as const;
  }, [data, members]);

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(message);
    } catch {
      setToast(message.replace("copied", "ready"));
    }
    setTimeout(() => setToast(null), 3000);
  };

  const executiveText = [
    "Forum Placement Dashboard Executive Summary",
    `Total members: ${counts.totalMembers}`,
    `In Forum: ${counts.membersInForum}`,
    `Free Agents: ${counts.freeAgents}`,
    `Ready To Assign: ${counts.readyToAssign}`,
    `Assigned / Pending Forum Review: ${counts.assignedPending}`,
    `Expiring soon: ${counts.assignmentsExpiringSoon}`,
    `Expired: ${counts.assignmentExpired}`,
    `Needs Info: ${counts.needsInfo}`,
    `Needs Conflict Review: ${counts.needsConflictReview}`,
    `Possible Duplicates: ${counts.possibleDuplicates}`,
    `Stale Records: ${counts.staleRecords}`
  ].join("\n");

  const placementText = pipeline.slice(0, 12).map((row) =>
    `${row.member.name} (${row.company}) - ${row.status} - ${row.forum?.name ?? "No Forum"} - ${row.recommendedAction}`
  ).join("\n");

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 print:px-0">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Executive overview</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Reports</h1>
          <p className="mt-2 text-sm text-muted">Placement health, assignment pipeline, Forum capacity, and data quality for demo walkthroughs.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <ActionButton icon={Clipboard} label="Copy Executive Summary" onClick={() => copyText(executiveText, "Executive summary copied")} />
          <ActionButton icon={Clipboard} label="Copy Placement Summary" onClick={() => copyText(placementText || "No assignment pipeline rows.", "Placement summary copied")} />
          <ActionButton icon={Printer} label="Print" onClick={() => window.print()} />
        </div>
      </header>

      {toast ? <div className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-3 text-sm font-semibold text-eo-teal">{toast}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Members" value={counts.totalMembers} detail="Active records." icon={UsersRound} tone="brand" />
        <StatCard label="Members In Forum" value={counts.membersInForum} detail="Confirmed only." icon={Network} tone="slate" />
        <StatCard label="Free Agents" value={counts.freeAgents} detail="Not assigned or confirmed." icon={UsersRound} tone="blue" />
        <StatCard label="New Members" value={counts.newMembers} detail="New intake/import records." icon={UsersRound} />
        <StatCard label="Ready To Assign" value={counts.readyToAssign} detail="Complete required info." icon={FileText} />
        <StatCard label="Assigned / Pending" value={counts.assignedPending} detail="Under Forum review." icon={FileText} tone="slate" />
        <StatCard label="Expiring Soon" value={counts.assignmentsExpiringSoon} detail="Under 14 days left." icon={FileText} tone="amber" />
        <StatCard label="Expired" value={counts.assignmentExpired} detail="Past 90-day window." icon={FileText} tone="amber" />
        <StatCard label="Needs Info" value={counts.needsInfo} detail="Missing required fields." icon={FileText} tone="amber" />
        <StatCard label="Needs Conflict Review" value={counts.needsConflictReview} detail="Relationship review needed." icon={FileText} tone="amber" />
        <StatCard label="Possible Duplicates" value={counts.possibleDuplicates} detail="Open duplicate cases." icon={FileText} tone="slate" />
        <StatCard label="Stale Records" value={counts.staleRecords} detail="Older than 180 days." icon={FileText} tone="slate" />
      </section>

      <ReportPanel title="Assignment Pipeline" actions={[
        { label: "Export CSV", onClick: () => downloadCsv("assignment-pipeline.csv", [["Member", "Company", "Forum", "Start", "Expiration", "Days Left", "Status", "Next Action"], ...pipeline.map((row) => [row.member.name, row.company, row.forum?.name ?? "", formatDate(row.assignmentStartDate), formatDate(row.assignmentExpiresAt), row.daysLeft ?? "", row.status, row.recommendedAction])]) }
      ]}>
        <PipelineTable rows={pipeline} />
      </ReportPanel>

      <ReportPanel title="Forum Capacity" actions={[
        { label: "Export CSV", onClick: () => downloadCsv("forum-capacity.csv", [["Forum", "Confirmed", "Max", "Open Seats", "Assigned Pending", "Shortlisted", "Location", "Style", "Status"], ...capacity.map((row) => [row.forum.name, row.confirmedCount, row.maxDesiredSize, row.openSeats, row.assignedPendingCount, row.shortlistedCount, row.forum.mainLocationZone, row.forum.forumStyle, row.capacityStatus])]) }
      ]}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-slate-50"><tr>{["Forum", "Confirmed", "Open", "Pending", "Shortlist", "Location", "Style", "Status"].map((heading) => <Th key={heading}>{heading}</Th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {capacity.map((row) => (
                <tr key={row.forum.id}>
                  <Td><ForumBadge forumId={row.forum.id} name={row.forum.name} href={`/forums/${row.forum.id}`} /></Td>
                  <Td>{row.confirmedCount}/{row.maxDesiredSize}</Td>
                  <Td>{row.openSeats}</Td>
                  <Td>{row.assignedPendingCount}</Td>
                  <Td>{row.shortlistedCount}</Td>
                  <Td>{row.forum.mainLocationZone}</Td>
                  <Td>{row.forum.forumStyle}</Td>
                  <Td>{row.capacityStatus}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportPanel>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <ReportPanel title="Data Quality Summary">
          <div className="grid gap-3 md:grid-cols-2">
            {qualityPreview.map(([label, preview]) => (
              <div key={label} className="rounded-lg border border-line bg-slate-50 p-3">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-xs text-muted">{preview.length} previewed</p>
                <div className="mt-2 space-y-1">
                  {preview.length === 0 ? <p className="text-xs text-slate-500">No records in this bucket.</p> : null}
                  {preview.map((member) => <Link key={member.id} href={`/members/${member.id}`} className="block text-xs font-semibold text-eo-blue">{member.name} · {member.company}</Link>)}
                </div>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Recent Placement Activity">
          <div className="space-y-3">
            {recentActivity.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-slate-50 p-3">
                <p className="text-sm font-semibold text-ink">{event.type}</p>
                <p className="mt-1 text-xs text-muted">{formatDate(event.createdAt)}{event.memberName ? ` · ${event.memberName}` : ""}{event.forumName ? ` · ${event.forumName}` : ""}</p>
                <p className="mt-1 text-sm text-slate-700">{event.detail}</p>
              </div>
            ))}
            {recentActivity.length === 0 ? <p className="text-sm text-muted">No recent placement activity yet.</p> : null}
          </div>
        </ReportPanel>
      </div>

      <button
        type="button"
        onClick={() => downloadCsv("members.csv", [["Name", "Company", "Industry", "Status", "Forum", "Home", "Business", "Revenue", "Years"], ...members.map((member) => [member.name, member.company, member.industry, member.status, forums.find((forum) => forum.id === (member.currentForumId ?? member.assignedForumId))?.name ?? "", member.homeLocation, member.businessLocation, member.revenueRange, member.yearsInBusiness])])}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card print:hidden"
      >
        <Download className="h-4 w-4" /> Export Members CSV
      </button>
      <PrivacyNote />
    </div>
  );
}

function PipelineTable({ rows }: { rows: ReturnType<typeof buildAssignmentPipeline> }) {
  const groups: AssignmentPipelineStatus[] = ["Pending Forum Review", "Expiring Soon", "Expired", "Recently Confirmed In Forum", "Recently Rejected"];
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupRows = rows.filter((row) => row.status === group);
        return (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group} · {groupRows.length}</p>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-slate-50"><tr>{["Member", "Forum", "Start", "Expires", "Days", "Status", "Next Action"].map((heading) => <Th key={heading}>{heading}</Th>)}</tr></thead>
                <tbody className="divide-y divide-line bg-white">
                  {groupRows.map((row) => (
                    <tr key={`${group}-${row.member.id}-${row.forum?.id ?? "none"}`}>
                      <Td><Link href={`/members/${row.member.id}`} className="font-semibold text-ink hover:text-eo-blue">{row.member.name}</Link><p className="text-xs text-muted">{row.company}</p></Td>
                      <Td>{row.forum?.name ?? "—"}</Td>
                      <Td>{formatDate(row.assignmentStartDate)}</Td>
                      <Td>{formatDate(row.assignmentExpiresAt)}</Td>
                      <Td>{row.daysLeft ?? "—"}</Td>
                      <Td><StatusBadge status={row.status === "Expired" ? "Assignment Expired" : row.status === "Recently Rejected" ? "Rejected" : row.status === "Recently Confirmed In Forum" ? "In Forum" : "Assigned / Pending Forum Review"} /></Td>
                      <Td>{row.recommendedAction}</Td>
                    </tr>
                  ))}
                  {groupRows.length === 0 ? <tr><Td colSpan={7}>No records in this group.</Td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportPanel({ title, children, actions = [] }: { title: string; children: React.ReactNode; actions?: { label: string; onClick: () => void }[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          {actions.map((action) => <button key={action.label} type="button" onClick={action.onClick} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">{action.label}</button>)}
        </div>
      </div>
      {children}
    </section>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="px-4 py-3 text-sm text-slate-700">{children}</td>;
}
