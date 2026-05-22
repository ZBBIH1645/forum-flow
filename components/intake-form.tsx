"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { businessStages, forumStyles, genders, revenueRanges, useLiveData } from "./live-data-provider";
import { LocationSelect } from "./location-select";
import { PrivacyNote } from "./privacy-note";
import type { BusinessStage, ForumStyle, Gender, IntakeDisclosures, Member } from "@/lib/types";

const disclosureFields = [
  { key: "bloodRelatives", label: "Blood relatives in the chapter" },
  { key: "spouse", label: "Spouse in the chapter" },
  { key: "currentBusinessPartners", label: "Current business partners in the chapter" },
  { key: "formerBusinessPartners", label: "Former business partners in the chapter" },
  { key: "priorBusinessRelationships", label: "Prior business relationships in the chapter" },
  { key: "directCompetitors", label: "Direct competitors in the chapter" },
  { key: "closeFriends", label: "Very close friends or best friends in the chapter" },
  { key: "otherNotes", label: "Other notes or special context", placeholder: "Anything else the placement chair should consider" }
] satisfies readonly { key: keyof IntakeDisclosures; label: string; placeholder?: string }[];

type DisclosureKey = typeof disclosureFields[number]["key"];
type DisclosureResponses = Record<DisclosureKey, boolean>;

type FormState = {
  firstName: string;
  lastName: string;
  company: string;
  industry: string;
  dateOfBirth: string;
  gender: Gender;
  homeLocation: string;
  businessLocation: string;
  revenueRange: string;
  employeeCount: string;
  yearsInBusiness: string;
  businessStage: BusinessStage;
  forumStylePreference: ForumStyle;
  currentForumStatusNote: string;
  disclosureResponses: DisclosureResponses;
  disclosures: IntakeDisclosures;
};

const blankDisclosureResponses = (): DisclosureResponses => ({
  bloodRelatives: false,
  spouse: false,
  currentBusinessPartners: false,
  formerBusinessPartners: false,
  priorBusinessRelationships: false,
  directCompetitors: false,
  closeFriends: false,
  otherNotes: false
});

const blankState = (): FormState => ({
  firstName: "",
  lastName: "",
  company: "",
  industry: "",
  dateOfBirth: "",
  gender: "Woman",
  homeLocation: "",
  businessLocation: "",
  revenueRange: revenueRanges[0],
  employeeCount: "",
  yearsInBusiness: "",
  businessStage: "Growth",
  forumStylePreference: "Balanced",
  currentForumStatusNote: "",
  disclosureResponses: blankDisclosureResponses(),
  disclosures: {
    bloodRelatives: "",
    spouse: "",
    currentBusinessPartners: "",
    formerBusinessPartners: "",
    priorBusinessRelationships: "",
    directCompetitors: "",
    closeFriends: "",
    otherNotes: ""
  }
});

const REQUIRED_TEXT_KEYS = [
  "firstName",
  "lastName",
  "company",
  "industry",
  "homeLocation",
  "businessLocation",
  "revenueRange"
] as const;

const normalizeDisclosures = (disclosures: IntakeDisclosures, responses: DisclosureResponses): IntakeDisclosures =>
  disclosureFields.reduce<IntakeDisclosures>((next, field) => {
    next[field.key] = responses[field.key] ? disclosures[field.key]?.trim() || "Yes" : "";
    return next;
  }, {});

export function IntakeForm() {
  const data = useLiveData();
  const [form, setForm] = useState<FormState>(() => blankState());
  const [submitted, setSubmitted] = useState<{ member: Member; duplicates: Member[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const possibleDuplicates = useMemo(() => {
    const candidate = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    if (!candidate && !form.company.trim()) return [];
    return data.findPossibleDuplicates({ name: candidate, company: form.company });
  }, [data, form.firstName, form.lastName, form.company]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateDisclosure = <K extends keyof IntakeDisclosures>(key: K, value: IntakeDisclosures[K]) => {
    setForm((current) => ({ ...current, disclosures: { ...current.disclosures, [key]: value } }));
  };

  const updateDisclosureResponse = (key: DisclosureKey, value: boolean) => {
    setForm((current) => ({
      ...current,
      disclosureResponses: { ...current.disclosureResponses, [key]: value },
      disclosures: value ? current.disclosures : { ...current.disclosures, [key]: "" }
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const missing: string[] = [];
    for (const key of REQUIRED_TEXT_KEYS) {
      if (!String(form[key] ?? "").trim()) missing.push(humanLabel(key));
    }
    if (!form.dateOfBirth) missing.push("Date of birth");
    if (!form.yearsInBusiness || Number(form.yearsInBusiness) <= 0) missing.push("Years in business");
    if (form.employeeCount === "" || Number(form.employeeCount) < 0) missing.push("Employee count");
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}.`);
      return;
    }

    const normalizedDisclosures = normalizeDisclosures(form.disclosures, form.disclosureResponses);
    const result = data.submitIntake({
      firstName: form.firstName,
      lastName: form.lastName,
      company: form.company,
      industry: form.industry,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      homeLocation: form.homeLocation,
      businessLocation: form.businessLocation,
      revenueRange: form.revenueRange,
      employeeCount: Number(form.employeeCount) || 0,
      yearsInBusiness: Number(form.yearsInBusiness) || 0,
      businessStage: form.businessStage,
      forumStylePreference: form.forumStylePreference,
      currentForumStatusNote: form.currentForumStatusNote,
      disclosures: normalizedDisclosures
    });
    setSubmitted(result);
  };

  if (submitted) {
    return (
      <PublicShell>
        <div className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-6 shadow-card">
          <CheckCircle2 className="h-8 w-8 text-eo-teal" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Thanks, {submitted.member.name.split(" ")[0]}!</h1>
          <p className="mt-2 text-sm text-slate-700">
            Your information has been submitted to the placement chair. They&rsquo;ll review it before recommending Forum options. You may be contacted if anything looks unclear or needs follow-up.
          </p>
        </div>

        {submitted.duplicates.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold"><AlertTriangle className="mr-1 inline h-4 w-4" /> A possible duplicate was flagged for the placement chair to review.</p>
            <p className="mt-1 text-xs text-amber-800">If you&rsquo;ve already submitted before or you share a name with another member, the chair will reach out before any duplicate placement decisions are made.</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setForm(blankState());
              setSubmitted(null);
            }}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink"
          >
            Submit another
          </button>
          <Link href="/" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Done</Link>
        </div>

        <PrivacyNote />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Forum Placement Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">New Member Intake</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Help us understand your business and Forum considerations so the placement chair can recommend the best Forum fit. The form takes about 5 minutes. Your responses are reviewed manually — nothing is auto-placed.
        </p>
      </header>

      {possibleDuplicates.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold"><AlertTriangle className="mr-1 inline h-4 w-4" /> Possible duplicate detected</p>
          <p className="mt-1 text-xs text-amber-800">A record matching {possibleDuplicates.map((m) => `${m.name} (${m.company})`).join(", ")} already exists. The placement chair will check this when they review your submission.</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mr-1 inline h-4 w-4" /> {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Section title="Your basics" subtitle="Required information used for placement matching.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name" value={form.firstName} onChange={(v) => update("firstName", v)} required />
            <Field label="Last name" value={form.lastName} onChange={(v) => update("lastName", v)} required />
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(v) => update("dateOfBirth", v)} required />
            <Select label="Gender" value={form.gender} options={genders} onChange={(v) => update("gender", v as Gender)} />
            <LocationSelect label="Home Location" value={form.homeLocation} onChange={(v) => update("homeLocation", v)} required />
            <LocationSelect label="Business Location" value={form.businessLocation} onChange={(v) => update("businessLocation", v)} required />
          </div>
        </Section>

        <Section title="Business details" subtitle="Used to match you with members at a similar stage.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company" value={form.company} onChange={(v) => update("company", v)} required />
            <Field label="Industry" value={form.industry} onChange={(v) => update("industry", v)} required placeholder="e.g., Construction, E-Commerce" />
            <Select label="Revenue range" value={form.revenueRange} options={revenueRanges} onChange={(v) => update("revenueRange", v)} />
            <Field label="Employee count" type="number" value={form.employeeCount} onChange={(v) => update("employeeCount", v)} required />
            <Field label="Years in business" type="number" value={form.yearsInBusiness} onChange={(v) => update("yearsInBusiness", v)} required />
            <Select label="Business stage" value={form.businessStage} options={businessStages} onChange={(v) => update("businessStage", v as BusinessStage)} />
          </div>
        </Section>

        <Section title="Forum preferences" subtitle="Helps us match style and current Forum status.">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Preferred Forum style" value={form.forumStylePreference} options={forumStyles} onChange={(v) => update("forumStylePreference", v as ForumStyle)} />
            <Field label="Current Forum status" value={form.currentForumStatusNote} onChange={(v) => update("currentForumStatusNote", v)} placeholder="None / visiting / former member, etc." />
          </div>
        </Section>

        <Section
          title="Relationship disclosures"
          subtitle="Tell us about anyone in the chapter you have a relationship with so we can avoid conflicts. Select Yes only where there is something the placement chair should know."
        >
          <div className="grid gap-4">
            {disclosureFields.map((field) => (
              <DisclosureField
                key={field.key}
                fieldKey={field.key}
                label={field.label}
                selectedYes={form.disclosureResponses[field.key]}
                value={form.disclosures[field.key] ?? ""}
                onSelectedChange={(value) => updateDisclosureResponse(field.key, value)}
                onChange={(value) => updateDisclosure(field.key, value)}
                placeholder={field.placeholder}
              />
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-600">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-eo-teal" />
            Submitting will create a draft record for the placement chair to review. Nothing is shared with any Forum until the chair confirms a recommendation.
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-eo-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card"
          >
            Submit intake
          </button>
        </div>
      </form>

      <PrivacyNote />
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cloud">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        {children}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-ink">{label}{required ? <span className="text-eo-pink"> *</span> : null}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
      />
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DisclosureField({
  fieldKey,
  label,
  selectedYes,
  value,
  onSelectedChange,
  onChange,
  placeholder = "Names or details if helpful"
}: {
  fieldKey: DisclosureKey;
  label: string;
  selectedYes: boolean;
  value: string;
  onSelectedChange: (value: boolean) => void;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const groupName = `disclosure-${fieldKey}`;

  return (
    <fieldset className="rounded-lg border border-line bg-slate-50 p-3">
      <legend className="px-1 text-sm font-semibold text-ink">{label}</legend>
      <div className="mt-2 flex gap-2">
        <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${!selectedYes ? "border-eo-purple bg-eo-lilac text-eo-purple" : "border-line bg-white text-slate-700"}`}>
          <input
            type="radio"
            name={groupName}
            checked={!selectedYes}
            onChange={() => onSelectedChange(false)}
            className="h-4 w-4 accent-eo-purple"
          />
          No
        </label>
        <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${selectedYes ? "border-eo-purple bg-eo-lilac text-eo-purple" : "border-line bg-white text-slate-700"}`}>
          <input
            type="radio"
            name={groupName}
            checked={selectedYes}
            onChange={() => onSelectedChange(true)}
            className="h-4 w-4 accent-eo-purple"
          />
          Yes
        </label>
      </div>
      {selectedYes ? (
        <label className="mt-3 block text-sm">
          <span className="font-semibold text-ink">Explain if helpful</span>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={2}
            placeholder={placeholder}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
          />
        </label>
      ) : null}
    </fieldset>
  );
}

function humanLabel(key: typeof REQUIRED_TEXT_KEYS[number]) {
  switch (key) {
    case "firstName": return "First name";
    case "lastName": return "Last name";
    case "company": return "Company";
    case "industry": return "Industry";
    case "homeLocation": return "Home location";
    case "businessLocation": return "Business location";
    case "revenueRange": return "Revenue range";
  }
}
