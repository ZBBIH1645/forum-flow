"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hourglass,
  LayoutGrid,
  MapPin,
  Scale,
  Search,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  XCircle
} from "lucide-react";
import { CompatibilityBadge } from "./compatibility-badge";
import { CompareCandidates } from "./compare-candidates";
import { ForumBadge } from "./forum-badge";
import { ForumLegend } from "./forum-legend";
import { PrivacyNote } from "./privacy-note";
import { StatusBadge } from "./status-badge";
import { useLiveData, decisionReasons } from "./live-data-provider";
import {
  getForumCompositionFromData,
  getFreeAgentMatchesForForumFromData,
  getOpenSeats
} from "@/lib/matching";
import { calculateAge, getAssignmentDaysLeft } from "@/lib/assignments";
import { daysSinceUpdate, isStaleRecord, missingRequiredFields } from "@/lib/data-quality";
import { inputLimits, sanitizeSingleLine } from "@/lib/security";
import { getFuzzySuggestions, getSearchableTerms, matchesSearch } from "@/lib/search";
import type { CompatibilityReview, DecisionReason, ForumGroup, Member } from "@/lib/types";

type FilterMode = "all" | "open-seats" | "with-shortlists";

export function ShortlistBoard() {
  const data = useLiveData();
  const { forums, members, relationships } = data;
  const [filter, setFilter] = useState<FilterMode>("open-seats");
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visibleForums = useMemo(() => {
    return forums.filter((forum) => {
      if (filter === "open-seats" && getOpenSeats(forum) === 0 && data.getActiveShortlistsForForum(forum.id).length === 0) return false;
      if (filter === "with-shortlists" && data.getActiveShortlistsForForum(forum.id).length === 0) return false;
      if (selectedForumId && forum.id !== selectedForumId) return false;
      return matchesSearch(query, [forum.name, forum.mainLocationZone, forum.forumStyle]);
    });
  }, [data, filter, forums, query, selectedForumId]);
  const searchTerms = useMemo(() => getSearchableTerms({ forums }), [forums]);
  const suggestions = useMemo(() => visibleForums.length === 0 ? getFuzzySuggestions(query, searchTerms) : [], [query, searchTerms, visibleForums.length]);

  const totalOpenSeats = forums.reduce((sum, forum) => sum + getOpenSeats(forum), 0);
  const totalShortlists = forums.reduce((sum, forum) => sum + data.getActiveShortlistsForForum(forum.id).length, 0);
  const totalAssigned = members.filter((member) => member.assignedForumId).length;

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Daily workbench</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Shortlist Board</h1>
          <p className="mt-2 text-sm text-muted">Review open Forum seats, build shortlists per Forum, and compare candidates side-by-side before assigning.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Stat label="Open seats" value={totalOpenSeats} icon={LayoutGrid} />
          <Stat label="Active shortlists" value={totalShortlists} icon={UserPlus} />
          <Stat label="Assigned (pending)" value={totalAssigned} icon={Hourglass} />
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["open-seats", "with-shortlists", "all"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                filter === mode ? "border-eo-purple bg-eo-purple text-white" : "border-line bg-white text-slate-700 hover:border-eo-blue"
              }`}
            >
              {mode === "open-seats" ? "Forums with open seats" : mode === "with-shortlists" ? "Forums with shortlists" : "All Forums"}
            </button>
          ))}
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(sanitizeSingleLine(event.target.value, inputLimits.search))}
            placeholder="Search Forum, zone, style"
            maxLength={inputLimits.search}
            className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10 sm:w-72"
          />
        </label>
      </div>

      <ForumLegend selectedForumId={selectedForumId ?? undefined} onSelectForum={setSelectedForumId} />

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleForums.map((forum) => (
          <ForumColumn
            key={forum.id}
            forum={forum}
            members={members}
            relationships={relationships}
            data={data}
          />
        ))}
        {visibleForums.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-line bg-white p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">No Forums match the current filter.</p>
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
        ) : null}
      </div>

      <PrivacyNote />
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof LayoutGrid }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3 shadow-card">
      <Icon className="h-4 w-4 text-eo-purple" />
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function ForumColumn({
  forum,
  members,
  relationships,
  data
}: {
  forum: ForumGroup;
  members: Member[];
  relationships: ReturnType<typeof useLiveData>["relationships"];
  data: ReturnType<typeof useLiveData>;
}) {
  const composition = getForumCompositionFromData(forum, members);
  const openSeats = getOpenSeats(forum);

  const assignedCandidates = members.filter((member) => member.assignedForumId === forum.id);
  const shortlistedDecisions = data.getActiveShortlistsForForum(forum.id);
  const shortlistedMembers = shortlistedDecisions
    .map((decision) => members.find((m) => m.id === decision.memberId))
    .filter((member): member is Member => Boolean(member))
    .filter((member) => !member.currentForumId && !member.assignedForumId);
  const recentRejections = data.getRecentRejectionsForForum(forum.id);

  const allMatches = useMemo(
    () => getFreeAgentMatchesForForumFromData(forum, members, relationships),
    [forum, members, relationships]
  );

  // Suppress already-assigned, already-shortlisted, and previously rejected pairings from suggestions.
  const shortlistedIds = new Set(shortlistedMembers.map((member) => member.id));
  const assignedIds = new Set(assignedCandidates.map((member) => member.id));
  const suggestedMatches = allMatches.filter((match) => {
    if (assignedIds.has(match.member.id)) return false;
    if (shortlistedIds.has(match.member.id)) return false;
    if ((match.member.rejectedForumIds ?? []).includes(forum.id)) return false;
    return true;
  }).slice(0, 6);

  const [showCompare, setShowCompare] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);

  // Auto-pick top 3 for compare default if no selection.
  const compareIds = compareSelection.length > 0
    ? compareSelection
    : [...shortlistedMembers.map((m) => m.id), ...suggestedMatches.map((m) => m.member.id)].slice(0, 3);

  const toggleCompareSelection = (memberId: string) => {
    setCompareSelection((current) => {
      if (current.includes(memberId)) return current.filter((id) => id !== memberId);
      if (current.length >= 4) return current;
      return [...current, memberId];
    });
  };

  return (
    <div className="rounded-lg border border-line bg-white shadow-card">
      <div className="border-b border-line bg-eo-purple/5 px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <ForumBadge forumId={forum.id} name={forum.name} href={`/forums/${forum.id}`} size="md" />
            <p className="mt-1 text-xs text-muted">{forum.mainLocationZone} · {forum.forumStyle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${openSeats > 0 ? "bg-eo-teal/10 text-eo-teal" : "bg-slate-100 text-slate-600"}`}>
              {openSeats === 0 ? "Full" : `${openSeats} open`}
            </span>
            <button
              type="button"
              onClick={() => setShowCompare((open) => !open)}
              disabled={compareIds.length < 2}
              className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Scale className="h-3.5 w-3.5" />
              {showCompare ? "Hide compare" : "Compare candidates"}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Mini label="Confirmed" value={`${composition.members.length} / ${forum.maxDesiredSize}`} icon={UsersRound} />
          <Mini label="Revenue" value={composition.revenueRange} icon={Building2} />
          <Mini label="Years" value={composition.yearsRange} icon={Building2} />
          <Mini label="Age range" value={composition.ageRange} icon={UsersRound} />
          <Mini label="Industries" value={String(composition.industries.length)} icon={Sparkles} />
          <Mini label="Location" value={forum.mainLocationZone} icon={MapPin} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">{forum.groupNotes}</p>
        {forum.specialExpectations ? <p className="mt-1 text-xs leading-5 text-slate-500">{forum.specialExpectations}</p> : null}
      </div>

      {showCompare ? (
        <div className="border-b border-line p-4">
          <CompareCandidates forum={forum} candidateIds={compareIds} onClose={() => setShowCompare(false)} />
        </div>
      ) : null}

      <CandidateGroup
        title="Assigned / Pending Forum Review"
        emptyText="No candidates currently assigned to this Forum."
        items={assignedCandidates.map((member) => ({ member, review: undefined }))}
        renderRow={(member) => (
          <CandidateRow
            key={`assigned-${member.id}`}
            forum={forum}
            member={member}
            data={data}
            members={members}
            relationships={relationships}
            mode="assigned"
            compareSelected={compareSelection.includes(member.id)}
            onToggleCompare={() => toggleCompareSelection(member.id)}
          />
        )}
      />

      <CandidateGroup
        title="Shortlisted"
        emptyText="No shortlisted candidates yet — add some from the suggestions below."
        items={shortlistedMembers.map((member) => ({ member, review: undefined }))}
        renderRow={(member) => (
          <CandidateRow
            key={`shortlist-${member.id}`}
            forum={forum}
            member={member}
            data={data}
            members={members}
            relationships={relationships}
            mode="shortlisted"
            compareSelected={compareSelection.includes(member.id)}
            onToggleCompare={() => toggleCompareSelection(member.id)}
          />
        )}
      />

      {recentRejections.length > 0 ? (
        <div className="border-t border-line bg-rose-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Recently rejected</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {recentRejections.slice(0, 3).map((decision) => (
              <li key={decision.memberId} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                <Link href={`/members/${decision.memberId}`} className="font-semibold text-ink hover:text-eo-blue">{decision.memberName}</Link>
                <span className="text-muted">{decision.reason || decision.note || "Rejected"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <CandidateGroup
        title="Best suggested free agents"
        emptyText="No free agents are a strong fit right now."
        items={suggestedMatches.map((match) => ({ member: match.member, review: match }))}
        renderRow={(member, review) => (
          <CandidateRow
            key={`suggested-${member.id}`}
            forum={forum}
            member={member}
            review={review}
            data={data}
            members={members}
            relationships={relationships}
            mode="suggested"
            compareSelected={compareSelection.includes(member.id)}
            onToggleCompare={() => toggleCompareSelection(member.id)}
          />
        )}
      />
    </div>
  );
}

function Mini({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UsersRound }) {
  return (
    <div className="rounded-lg border border-line bg-white px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function CandidateGroup({
  title,
  emptyText,
  items,
  renderRow
}: {
  title: string;
  emptyText: string;
  items: { member: Member; review?: CompatibilityReview }[];
  renderRow: (member: Member, review?: CompatibilityReview) => React.ReactNode;
}) {
  return (
    <div className="border-t border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => renderRow(item.member, item.review))}
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  forum,
  member,
  review,
  data,
  members,
  relationships,
  mode,
  compareSelected,
  onToggleCompare
}: {
  forum: ForumGroup;
  member: Member;
  review?: CompatibilityReview;
  data: ReturnType<typeof useLiveData>;
  members: Member[];
  relationships: ReturnType<typeof useLiveData>["relationships"];
  mode: "assigned" | "shortlisted" | "suggested";
  compareSelected: boolean;
  onToggleCompare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<DecisionReason | "">("");
  const [toast, setToast] = useState<string | null>(null);

  const reasonValue = reason ? reason : undefined;

  // For assigned/shortlisted rows, derive a label on the fly.
  const derivedReview = useMemo(() => {
    if (review) return review;
    const matches = getFreeAgentMatchesForForumFromData(forum, [member, ...members.filter((m) => m.id !== member.id)], relationships);
    return matches.find((match) => match.member.id === member.id);
  }, [review, forum, member, members, relationships]);

  const isShortlisted = data.isCurrentlyShortlistedForPair(member.id, forum.id);
  const blocked = derivedReview?.label === "Blocked";
  const daysLeft = mode === "assigned" ? getAssignmentDaysLeft(member) : null;
  const memberQuality = data.getDataQuality(member);
  const memberMissing = missingRequiredFields(memberQuality);
  const memberHasMissing = memberMissing.length > 0;
  const memberStale = isStaleRecord(member);
  const memberDaysSince = daysSinceUpdate(member);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const keyReason = derivedReview?.positiveSignals[0];
  const keyConcern = derivedReview?.hardBlockers[0] ?? derivedReview?.softWarnings[0];

  const tryAssign = () => {
    if (memberHasMissing && !note.trim()) {
      showToast("This member is missing required info — add a decision note to override.");
      return;
    }
    data.assignToForum({ member, forum, note, reason: reasonValue });
    showToast(memberHasMissing ? "Assigned with override note" : "Assigned to Forum");
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-line bg-slate-50/60 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/members/${member.id}`} className="text-sm font-semibold text-ink hover:text-eo-blue">{member.name}</Link>
            <StatusBadge status={data.getEffectiveStatus(member)} />
            {derivedReview ? <CompatibilityBadge label={derivedReview.label} /> : null}
            {daysLeft !== null ? (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${daysLeft < 0 ? "bg-rose-100 text-rose-800" : daysLeft <= 14 ? "bg-amber-100 text-amber-900" : "bg-indigo-100 text-indigo-800"}`}>
                <Clock className="h-3 w-3" />
                {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d left`}
              </span>
            ) : null}
            {memberHasMissing ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900" title={`Missing: ${memberMissing.join(", ")}`}>
                <AlertTriangle className="h-3 w-3" /> Needs info
              </span>
            ) : null}
            {memberStale ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Stale</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-700">{member.company || "—"} · {member.industry || "—"}</p>
          <p className="text-xs text-muted">
            {member.dateOfBirth ? `${calculateAge(member)} yrs` : "Age unknown"} · {member.gender} · home {member.homeLocation || "—"} · biz {member.businessLocation || "—"} · {member.revenueRange || "—"} · {member.yearsInBusiness || "—"} yrs in business
          </p>
          {memberDaysSince !== null ? (
            <p className="text-xs text-muted">Last updated {memberDaysSince === 0 ? "today" : memberDaysSince === 1 ? "1 day ago" : `${memberDaysSince} days ago`}</p>
          ) : null}
          {mode === "assigned" ? (
            <p className="text-xs text-muted">
              Assignment start {member.assignmentStartDate ? new Date(member.assignmentStartDate).toLocaleDateString() : "—"} · expires {member.assignmentExpiresAt ? new Date(member.assignmentExpiresAt).toLocaleDateString() : "—"}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            {keyReason ? <span className="text-eo-teal">Why: {keyReason}</span> : null}
            {keyConcern ? <span className="text-amber-800"><AlertTriangle className="mr-1 inline h-3 w-3" />{keyConcern}</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={compareSelected} onChange={onToggleCompare} className="h-3.5 w-3.5 rounded border-line text-eo-purple" />
            Compare
          </label>
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink">
            Actions <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {toast ? <p className="mt-2 text-xs font-semibold text-eo-teal"><CheckCircle2 className="mr-1 inline h-3 w-3" />{toast}</p> : null}

      {open ? (
        <div className="mt-3 rounded-lg border border-line bg-white p-3">
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
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              href={`/members/${member.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink"
            >
              View profile
            </Link>
            {mode !== "assigned" ? (
              !isShortlisted ? (
                <button
                  type="button"
                  onClick={() => {
                    data.addToShortlist({ member, forum, note, reason: reasonValue });
                    showToast("Shortlisted");
                    setOpen(false);
                  }}
                  disabled={blocked}
                  className="inline-flex items-center gap-1 rounded-lg border border-eo-pink/20 bg-eo-pink/10 px-2 py-1 text-xs font-semibold text-eo-pink disabled:opacity-40"
                >
                  <UserPlus className="h-3 w-3" /> Add to shortlist
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    data.removeFromShortlist({ member, forum, note });
                    showToast("Removed from shortlist");
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <UserMinus className="h-3 w-3" /> Remove from shortlist
                </button>
              )
            ) : null}
            {mode !== "assigned" ? (
              <button
                type="button"
                onClick={tryAssign}
                disabled={blocked}
                title={memberHasMissing ? `Missing: ${memberMissing.join(", ")}. A decision note is required to override.` : undefined}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white disabled:bg-slate-300 ${memberHasMissing ? "bg-amber-600" : "bg-eo-purple"}`}
              >
                <CheckCircle2 className="h-3 w-3" /> {memberHasMissing ? "Assign (override needs info)" : "Assign to Forum"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    data.confirmInForum({ member, forum, note, reason: reasonValue });
                    showToast("Confirmed in Forum");
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-eo-teal px-2 py-1 text-xs font-semibold text-white"
                >
                  <UserCheck className="h-3 w-3" /> Confirm / Mark In Forum
                </button>
                <button
                  type="button"
                  onClick={() => {
                    data.rejectAssignment({ member, forum, note, reason: reasonValue });
                    showToast("Returned to Free Agents");
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                >
                  <XCircle className="h-3 w-3" /> Reject / Return
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                data.updateMemberStatus({ member, status: "Needs Conflict Review", note });
                showToast("Marked Needs Review");
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
            >
              Mark Needs Review
            </button>
            {mode !== "assigned" ? (
              <button
                type="button"
                onClick={() => {
                  data.rejectPairing({ member, forum, note, reason: reasonValue });
                  showToast("Pairing rejected");
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
              >
                <XCircle className="h-3 w-3" /> Reject pairing
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!note.trim()) return;
                data.addDecisionNote({ member, forum, note, reason: reasonValue });
                showToast("Decision note saved");
                setNote("");
                setOpen(false);
              }}
              disabled={!note.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink disabled:opacity-40"
            >
              Add decision note
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
