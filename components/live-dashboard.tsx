"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, Network, UsersRound } from "lucide-react";
import { ActivityList } from "./activity-list";
import { ForumBadge } from "./forum-badge";
import { ForumLegend } from "./forum-legend";
import { LocalPlacementDecisions } from "./local-placement-decisions";
import { PrivacyNote } from "./privacy-note";
import { StatCard } from "./stat-card";
import { useLiveData } from "./live-data-provider";
import { getOpenSeats } from "@/lib/matching";

export function LiveDashboard() {
  const { members, forums, placements, relationships } = useLiveData();
  const freeAgents = members.filter((member) => !member.currentForumId && !member.assignedForumId && member.status !== "Former Member");
  const membersInForums = members.filter((member) => Boolean(member.currentForumId));
  const forumsWithOpenSeats = forums.filter((forum) => getOpenSeats(forum) > 0);
  const pendingConflictReviews = members.filter((member) =>
    member.status === "Needs Conflict Review" || relationships.some((relationship) =>
      (relationship.memberId === member.id || relationship.relatedMemberId === member.id) && relationship.severity !== "Note Only"
    )
  );

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Forum Placement Dashboard</h1>
          <p className="mt-2 text-sm text-muted">Review live member data, Forum capacity, conflicts, and recent placement decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/intake" target="_blank" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-card">
            Open member intake
          </Link>
          <Link href="/members/new" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-card">
            Add member
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={members.length} detail="Current live member records." icon={UsersRound} tone="brand" />
        <StatCard label="Members in Forums" value={membersInForums.length} detail="Members assigned to current Forum groups." icon={Network} tone="slate" />
        <StatCard label="Free agents" value={freeAgents.length} detail="Members who still need placement review." icon={ClipboardList} tone="blue" />
        <StatCard label="Active Forums" value={forums.length} detail="Groups available for compatibility review." icon={CheckCircle2} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Forums with open seats" value={forumsWithOpenSeats.length} detail="Open capacity based on live assignments." icon={CheckCircle2} />
        <StatCard label="Conflict/review flags" value={pendingConflictReviews.length} detail="Members with review status or relationship flags." icon={AlertTriangle} tone="amber" />
        <StatCard label="Placement decisions" value={placements.length} detail="Static and local placement decisions." icon={ClipboardList} tone="slate" />
      </div>

      <ForumLegend limit={12} />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Forum seat map</h2>
            <Link href="/forums" className="text-sm font-semibold text-eo-blue">View all</Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {forums.slice(0, 12).map((forum) => {
              const openSeats = getOpenSeats(forum);
              return (
                <Link key={forum.id} href={`/forums/${forum.id}`} className="rounded-lg border border-line bg-slate-50 p-3 transition hover:border-eo-blue hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <ForumBadge forumId={forum.id} name={forum.name} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${openSeats > 1 ? "bg-eo-teal/10 text-eo-teal" : openSeats === 1 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                      {openSeats === 0 ? "Full" : `${openSeats} open`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted">{forum.currentMemberIds.length}/{forum.maxDesiredSize} members · {forum.mainLocationZone}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <ActivityList />
      </div>

      <LocalPlacementDecisions title="Local placement decisions" />
      <PrivacyNote />
    </div>
  );
}
