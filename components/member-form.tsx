"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  businessStages,
  forumStyles,
  genders,
  memberStatuses,
  revenueRanges,
  useLiveData
} from "./live-data-provider";
import { LocationSelect } from "./location-select";
import type { Member } from "@/lib/types";

const blankMember = (): Omit<Member, "id"> => ({
  name: "",
  company: "",
  industry: "",
  businessLocation: "",
  homeLocation: "",
  gender: "Man",
  age: 45,
  ageRange: "40-49",
  revenueRange: "$1M-$3M",
  employeeCount: 1,
  yearsInBusiness: 1,
  businessStage: "Growth",
  status: "New Member",
  forumStylePreference: "Balanced",
  knownRelatives: [],
  spouseInChapter: [],
  businessPartners: [],
  previousBusinessRelationships: [],
  hardConflictMemberIds: [],
  directCompetitors: [],
  closeFriends: [],
  notes: "",
  currentForumId: undefined
});

const ageRangeFor = (age: number) => age >= 60 ? "60+" : age >= 50 ? "50-59" : age >= 40 ? "40-49" : "30-39";

export function MemberForm({ memberId }: { memberId?: string }) {
  const router = useRouter();
  const { members, forums, addMember, saveMember } = useLiveData();
  const existing = memberId ? members.find((member) => member.id === memberId) : undefined;
  const [form, setForm] = useState<Omit<Member, "id">>(() => existing ? { ...existing } : blankMember());

  useEffect(() => {
    if (existing) setForm({ ...existing });
  }, [existing]);

  const duplicateWarnings = useMemo(() => {
    const normalizedName = form.name.trim().toLowerCase();
    const normalizedCompany = form.company.trim().toLowerCase();
    if (!normalizedName && !normalizedCompany) return [];
    return members
      .filter((member) => member.id !== memberId)
      .filter((member) => {
        const memberName = member.name.toLowerCase();
        return (normalizedName && (memberName === normalizedName || memberName.includes(normalizedName) || normalizedName.includes(memberName)))
          || (normalizedCompany && member.company.toLowerCase() === normalizedCompany);
      })
      .slice(0, 4);
  }, [form.company, form.name, memberId, members]);

  const update = <K extends keyof Omit<Member, "id">>(key: K, value: Omit<Member, "id">[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const normalized = {
      ...form,
      name: form.name.trim(),
      company: form.company.trim(),
      industry: form.industry.trim(),
      homeLocation: form.homeLocation.trim(),
      businessLocation: form.businessLocation.trim(),
      ageRange: ageRangeFor(form.age),
      currentForumId: form.currentForumId || undefined
    };
    if (!normalized.name || !normalized.company) return;
    const saved = existing ? { ...normalized, id: existing.id } : addMember(normalized);
    if (existing) saveMember(saved);
    router.push(`/members/${saved.id}`);
  };

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">{existing ? "Edit member" : "Add member"}</h2>
          <p className="text-sm text-muted">Keep placement data current as members join or change Forums.</p>
        </div>
        <button onClick={save} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">
          {existing ? "Save changes" : "Add member"}
        </button>
      </div>

      {duplicateWarnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Possible duplicate</p>
          <p className="mt-1">{duplicateWarnings.map((member) => `${member.name} (${member.company})`).join(", ")}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Name" value={form.name} onChange={(value) => update("name", value)} />
        <Field label="Company" value={form.company} onChange={(value) => update("company", value)} />
        <Field label="Industry" value={form.industry} onChange={(value) => update("industry", value)} />
        <LocationSelect label="Home Location" value={form.homeLocation} onChange={(value) => update("homeLocation", value)} />
        <LocationSelect label="Business Location" value={form.businessLocation} onChange={(value) => update("businessLocation", value)} />
        <Select label="Gender" value={form.gender} options={genders} onChange={(value) => update("gender", value as Member["gender"])} />
        <Field label="Age" type="number" value={String(form.age)} onChange={(value) => update("age", Number(value) || 0)} />
        <Select label="Revenue range" value={form.revenueRange} options={revenueRanges} onChange={(value) => update("revenueRange", value)} />
        <Field label="Employee count" type="number" value={String(form.employeeCount)} onChange={(value) => update("employeeCount", Number(value) || 0)} />
        <Field label="Years in business" type="number" value={String(form.yearsInBusiness)} onChange={(value) => update("yearsInBusiness", Number(value) || 0)} />
        <Select label="Business stage" value={form.businessStage} options={businessStages} onChange={(value) => update("businessStage", value as Member["businessStage"])} />
        <Select label="Status" value={form.status} options={memberStatuses} onChange={(value) => update("status", value as Member["status"])} />
        <Select label="Current Forum" value={form.currentForumId ?? ""} options={["", ...forums.map((forum) => forum.id)]} labels={{ "": "Unassigned", ...Object.fromEntries(forums.map((forum) => [forum.id, forum.name])) }} onChange={(value) => update("currentForumId", value || undefined)} />
        <Select label="Forum style preference" value={form.forumStylePreference} options={forumStyles} onChange={(value) => update("forumStylePreference", value as Member["forumStylePreference"])} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Notes / other info</span>
        <textarea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
        />
      </label>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  labels = {},
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
      >
        {options.map((option) => <option key={option || "none"} value={option}>{labels[option] ?? option}</option>)}
      </select>
    </label>
  );
}
