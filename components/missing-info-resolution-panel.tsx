"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, PauseCircle, PencilLine, Send } from "lucide-react";
import { revenueRanges, useLiveData } from "./live-data-provider";
import { LocationSelect } from "./location-select";
import { StatusBadge } from "./status-badge";
import {
  hasCompletedRequiredInfo,
  missingRequiredFields,
  REQUIRED_FIELD_DETAILS
} from "@/lib/data-quality";
import type { DataQualityLabel, Member } from "@/lib/types";

type Draft = {
  homeLocation: string;
  businessLocation: string;
  revenueRange: string;
  yearsInBusiness: string;
  dateOfBirth: string;
  industry: string;
  relationshipReviewCompleted: boolean;
};

export function MissingInfoResolutionPanel({
  member,
  compact = false
}: {
  member: Member;
  compact?: boolean;
}) {
  const data = useLiveData();
  const quality = data.getDataQuality(member);
  const missing = missingRequiredFields(quality);
  const hasMissing = missing.length > 0;
  const canMarkReady = !member.currentForumId && !member.assignedForumId && hasCompletedRequiredInfo(quality);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    homeLocation: member.homeLocation ?? "",
    businessLocation: member.businessLocation ?? "",
    revenueRange: member.revenueRange ?? "",
    yearsInBusiness: member.yearsInBusiness ? String(member.yearsInBusiness) : "",
    dateOfBirth: member.dateOfBirth ?? "",
    industry: member.industry ?? "",
    relationshipReviewCompleted: Boolean(member.relationshipReviewCompleted)
  });

  const requestedEvent = useMemo(() => data.activity.find((event) =>
    event.memberId === member.id && event.detail.toLowerCase().includes("info requested")
  ), [data.activity, member.id]);

  if (!hasMissing && !compact && member.status !== "Needs Info" && member.status !== "On Hold") return null;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  };

  const saveMissingInfo = () => {
    const updates: Partial<Member> = {};
    if (missing.includes("Missing Home Location")) updates.homeLocation = draft.homeLocation.trim();
    if (missing.includes("Missing Business Location")) updates.businessLocation = draft.businessLocation.trim();
    if (missing.includes("Missing Revenue")) updates.revenueRange = draft.revenueRange;
    if (missing.includes("Missing Years in Business")) updates.yearsInBusiness = Number(draft.yearsInBusiness) || 0;
    if (missing.includes("Missing DOB")) updates.dateOfBirth = draft.dateOfBirth || undefined;
    if (missing.includes("Missing Industry")) updates.industry = draft.industry.trim();
    if (missing.includes("Missing Relationship Review")) updates.relationshipReviewCompleted = draft.relationshipReviewCompleted;
    data.updateMissingInfo({ member, updates, note });
    setEditing(false);
    setNote("");
    showToast("Missing info updated");
  };

  const runNoteAction = (action: "requested" | "note" | "hold" | "override") => {
    if (action === "requested") {
      data.markInfoRequested({ member, note });
      showToast("Info requested");
    }
    if (action === "note") {
      data.addDecisionNote({ member, note });
      showToast("Note added");
    }
    if (action === "hold") {
      data.putMemberOnHold({ member, note });
      showToast("Member put on hold");
    }
    if (action === "override") {
      data.addDecisionNote({ member, note: `Missing info override: ${note}` });
      showToast("Override note saved");
    }
    setNote("");
  };

  const recommended = hasMissing
    ? "Add the missing fields, request them manually, or document why you are continuing."
    : canMarkReady
    ? "Required info is complete. Mark Ready To Assign when review is done."
    : "No required fields are missing.";

  return (
    <div className={`rounded-lg border ${hasMissing ? "border-amber-200 bg-amber-50" : "border-eo-teal/20 bg-eo-teal/5"} p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Missing Info</p>
            <StatusBadge status={data.getEffectiveStatus(member)} />
            {requestedEvent ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                Info Requested on {new Date(requestedEvent.createdAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-700">
            {hasMissing ? "This member is missing information required before assignment." : "Required placement information is complete."}
          </p>
          <p className="mt-1 text-xs font-medium text-eo-purple">Recommended next action: {recommended}</p>
        </div>
        {canMarkReady ? (
          <button
            type="button"
            onClick={() => {
              data.markReadyToAssign({ member, note });
              showToast("Marked Ready To Assign");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-eo-purple px-3 py-2 text-xs font-semibold text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Ready To Assign
          </button>
        ) : null}
      </div>

      {hasMissing ? (
        <div className="mt-3 grid gap-2">
          {missing.map((label) => (
            <div key={label} className="rounded-lg border border-amber-200 bg-white p-2">
              <p className="text-xs font-semibold text-amber-950">
                <AlertTriangle className="mr-1 inline h-3 w-3" />{REQUIRED_FIELD_DETAILS[label].displayName}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">{REQUIRED_FIELD_DETAILS[label].why}</p>
            </div>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-line bg-white p-3">
          <MissingFieldInputs missing={missing} draft={draft} setDraft={setDraft} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveMissingInfo} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
              Save Missing Info
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Note or reason</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          placeholder="Asked member to confirm revenue range, DOB pending, chair review pending..."
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {hasMissing ? (
          <button type="button" onClick={() => setEditing((open) => !open)} className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
            <PencilLine className="h-3.5 w-3.5" /> Add Missing Info
          </button>
        ) : null}
        <button type="button" onClick={() => runNoteAction("requested")} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
          <Send className="h-3.5 w-3.5" /> Mark Info Requested
        </button>
        <button type="button" onClick={() => runNoteAction("note")} disabled={!note.trim()} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40">
          <MessageSquare className="h-3.5 w-3.5" /> Add Note
        </button>
        <button type="button" onClick={() => runNoteAction("hold")} disabled={!note.trim()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">
          <PauseCircle className="h-3.5 w-3.5" /> Put On Hold
        </button>
        <button type="button" onClick={() => runNoteAction("override")} disabled={!note.trim()} className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 disabled:opacity-40">
          Override With Note
        </button>
      </div>
      {toast ? <p className="mt-3 text-xs font-semibold text-eo-teal"><CheckCircle2 className="mr-1 inline h-3 w-3" />{toast}</p> : null}
    </div>
  );
}

function MissingFieldInputs({
  missing,
  draft,
  setDraft
}: {
  missing: DataQualityLabel[];
  draft: Draft;
  setDraft: (draft: Draft) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {missing.includes("Missing Home Location") ? <LocationSelect label="Home Location" value={draft.homeLocation} onChange={(value) => setDraft({ ...draft, homeLocation: value })} /> : null}
      {missing.includes("Missing Business Location") ? <LocationSelect label="Business Location" value={draft.businessLocation} onChange={(value) => setDraft({ ...draft, businessLocation: value })} /> : null}
      {missing.includes("Missing Industry") ? <TextInput label="Industry" value={draft.industry} onChange={(value) => setDraft({ ...draft, industry: value })} /> : null}
      {missing.includes("Missing Years in Business") ? <TextInput label="Years in Business" type="number" value={draft.yearsInBusiness} onChange={(value) => setDraft({ ...draft, yearsInBusiness: value })} /> : null}
      {missing.includes("Missing DOB") ? <TextInput label="Date of Birth" type="date" value={draft.dateOfBirth} onChange={(value) => setDraft({ ...draft, dateOfBirth: value })} /> : null}
      {missing.includes("Missing Revenue") ? (
        <label>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Revenue Range</span>
          <select value={draft.revenueRange} onChange={(event) => setDraft({ ...draft, revenueRange: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink">
            <option value="">Choose revenue range</option>
            {revenueRanges.map((range) => <option key={range} value={range}>{range}</option>)}
          </select>
        </label>
      ) : null}
      {missing.includes("Missing Relationship Review") ? (
        <label className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={draft.relationshipReviewCompleted} onChange={(event) => setDraft({ ...draft, relationshipReviewCompleted: event.target.checked })} className="h-4 w-4 rounded border-line text-eo-purple" />
          Relationship review completed
        </label>
      ) : null}
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
      />
    </label>
  );
}
