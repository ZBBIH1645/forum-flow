"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, Download,
  FileSpreadsheet, ListChecks, ShieldAlert, Trash2, Upload, Users
} from "lucide-react";
import { useLiveData, type ImportSummary } from "./live-data-provider";
import { PrivacyNote } from "./privacy-note";
import { parseCsv, type ParsedCsv } from "@/lib/csv";
import {
  IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, SAMPLE_CSV,
  analyzeRows, buildMemberFromRow, computeImpact, settleStatusAfterBuild, suggestMapping,
  type FieldMapping, type ImportField, type ImportImpact, type RowAction, type RowOutcome
} from "@/lib/import";
import type { ActivityEvent } from "@/lib/types";

type StepId = "add" | "preview" | "map" | "impact" | "commit";

const STEPS: { id: StepId; label: string }[] = [
  { id: "add", label: "Add data" },
  { id: "preview", label: "Preview" },
  { id: "map", label: "Field mapping" },
  { id: "impact", label: "Impact summary" },
  { id: "commit", label: "Commit" }
];

const STORAGE_DRAFT_KEY = "forumflow.import.draft.csv";

export function ImportDataWizard() {
  const data = useLiveData();
  const [step, setStep] = useState<StepId>("add");
  const [csvText, setCsvText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_DRAFT_KEY) ?? "";
  });
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);
  const [commitResult, setCommitResult] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseCsv(csvText), [csvText]);

  const updateCsv = useCallback((next: string) => {
    setCsvText(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_DRAFT_KEY, next);
  }, []);

  const goToPreview = useCallback(() => {
    setMapping((current) => Object.keys(current).length === 0 ? suggestMapping(parsed.headers) : current);
    setStep("preview");
  }, [parsed.headers]);

  const refreshOutcomes = useCallback(() => {
    setOutcomes(analyzeRows(parsed.rows, parsed.rowNumbers, parsed.headers, mapping, data.members, data.forums));
  }, [data.forums, data.members, mapping, parsed.headers, parsed.rowNumbers, parsed.rows]);

  // Recompute outcomes whenever mapping or parsed data changes and we are past Add step.
  useEffect(() => { if (step !== "add") refreshOutcomes(); }, [refreshOutcomes, step]);

  const impact = useMemo(() => computeImpact(outcomes), [outcomes]);
  const mappedHeaders = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const mappedFieldCount = useMemo(() => Object.values(mapping).filter(Boolean).length, [mapping]);
  const unmappedHeaders = useMemo(() => parsed.headers.filter((header) => !mappedHeaders.has(header)), [mappedHeaders, parsed.headers]);
  const openDuplicates = data.duplicateCases.filter((duplicate) => duplicate.status === "Unresolved" || duplicate.status === "Skipped");

  const updateRowAction = (rowNumber: number, action: RowAction) =>
    setOutcomes((current) => current.map((o) => o.rowNumber === rowNumber ? { ...o, action } : o));

  const clearDraft = () => {
    updateCsv("");
    setMapping({});
    setOutcomes([]);
    setCommitResult(null);
    setStep("add");
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    updateCsv(text);
  };

  const commit = useCallback(() => {
    const startedAt = new Date().toISOString();
    const summaryId = `import-${Date.now()}`;
    const startedEvent: Omit<ActivityEvent, "id" | "createdAt"> = {
      type: "Import started",
      detail: `CSV import started (${outcomes.length} row${outcomes.length === 1 ? "" : "s"}).`
    };
    data.addImportActivities([startedEvent]);

    const events: Omit<ActivityEvent, "id" | "createdAt">[] = [];
    const created: typeof data.members = [];
    const updated: typeof data.members = [];

    for (const outcome of outcomes) {
      if (outcome.action === "skip") {
        events.push({
          type: "Import row skipped",
          memberName: outcome.name,
          detail: `Row ${outcome.rowNumber} (${outcome.name || "unnamed"}) skipped${outcome.duplicates.length > 0 ? ` (possible duplicate: ${outcome.duplicates[0].name})` : ""}.`
        });
        if (outcome.duplicates.length > 0) {
          const { draft } = buildMemberFromRow(outcome, data.forums);
          outcome.duplicates.forEach((duplicate) => data.recordDuplicateCase({
            memberA: duplicate,
            draftMember: { ...draft, id: `mem-import-draft-${summaryId}-${outcome.rowNumber}`, status: "New Member" },
            source: "Import",
            rowNumber: outcome.rowNumber,
            rowName: outcome.name,
            importSummaryId: summaryId
          }));
          events.push({
            type: "Import duplicate flagged",
            memberId: outcome.duplicates[0].id,
            memberName: outcome.duplicates[0].name,
            detail: `Possible duplicate of imported row ${outcome.rowNumber} (${outcome.name || "unnamed"}).`
          });
        }
        continue;
      }

      if (outcome.action === "update" && outcome.matchedExistingId) {
        const baseline = data.members.find((m) => m.id === outcome.matchedExistingId);
        if (!baseline) continue;
        const { draft } = buildMemberFromRow(outcome, data.forums, baseline);
        const settled = settleStatusAfterBuild(draft, data.relationships);
        updated.push(settled);
        events.push({
          type: "Member updated by import",
          memberId: settled.id,
          memberName: settled.name,
          detail: `${settled.name} updated from CSV row ${outcome.rowNumber}.`
        });
        continue;
      }

      // create
      const { draft } = buildMemberFromRow(outcome, data.forums);
      const settled = settleStatusAfterBuild(draft, data.relationships);
      created.push(settled);
      events.push({
        type: "Member imported",
        memberId: settled.id,
        memberName: settled.name,
        detail: `${settled.name} imported from CSV row ${outcome.rowNumber}.`
      });
      if (outcome.duplicates.length > 0) {
        outcome.duplicates.forEach((duplicate) => data.recordDuplicateCase({
          memberA: duplicate,
          memberB: settled,
          source: "Import",
          rowNumber: outcome.rowNumber,
          rowName: outcome.name,
          importSummaryId: summaryId
        }));
        events.push({
          type: "Import duplicate flagged",
          memberId: settled.id,
          memberName: settled.name,
          detail: `Created despite possible duplicate(s): ${outcome.duplicates.map((d) => d.name).join(", ")}.`
        });
      }
    }

    if (created.length > 0) data.addMembersBulk(created);
    if (updated.length > 0) data.updateMembersBulk(updated);

    const completedAt = new Date().toISOString();
    events.push({
      type: "Import completed",
      detail: `Import committed: ${created.length} created, ${updated.length} updated, ${impact.toSkip} skipped.`
    });
    data.addImportActivities(events);

    const summary: ImportSummary = {
      id: summaryId,
      startedAt,
      completedAt,
      rowsTotal: outcomes.length,
      created: created.length,
      updated: updated.length,
      skipped: impact.toSkip,
      duplicateFlagged: outcomes.filter((o) => o.duplicates.length > 0).length,
      unknownForums: impact.unknownForumRows
    };
    data.recordImportSummary(summary);
    setCommitResult(summary);
  }, [data, impact.toSkip, impact.unknownForumRows, outcomes]);

  return (
    <div className="space-y-6">
      <Stepper current={step} onSelect={setStep} unlocked={parsed.rows.length > 0} />

      {openDuplicates.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <span><AlertTriangle className="mr-1 inline h-4 w-4" />{openDuplicates.length} possible duplicate{openDuplicates.length === 1 ? "" : "s"} waiting for review.</span>
          <Link href="/duplicate-review" className="inline-flex items-center justify-center rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
            Open Duplicate Review
          </Link>
        </div>
      ) : null}

      {step === "add" && (
        <AddStep
          csv={csvText}
          onCsvChange={updateCsv}
          onFile={onFile}
          fileInputRef={fileInputRef}
          parsedRows={parsed.rows.length}
          parsedHeaders={parsed.headers.length}
          parseErrors={parsed.errors}
          onContinue={goToPreview}
          onClear={clearDraft}
          summaries={data.importSummaries}
        />
      )}

      {step === "preview" && (
        <PreviewStep
          parsed={parsed}
          outcomes={outcomes}
          onBack={() => setStep("add")}
          onContinue={() => setStep("map")}
        />
      )}

      {step === "map" && (
        <MappingStep
          headers={parsed.headers}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep("preview")}
          onContinue={() => setStep("impact")}
        />
      )}

      {step === "impact" && (
        <ImpactStep
          impact={impact}
          headers={parsed.headers}
          mappedFieldCount={mappedFieldCount}
          unmappedHeaders={unmappedHeaders}
          outcomes={outcomes}
          onUpdateAction={updateRowAction}
          onBack={() => setStep("map")}
          onContinue={() => setStep("commit")}
        />
      )}

      {step === "commit" && (
        <CommitStep
          impact={impact}
          mappedFieldCount={mappedFieldCount}
          unmappedHeaders={unmappedHeaders}
          outcomes={outcomes}
          onBack={() => setStep("impact")}
          onCommit={commit}
          result={commitResult}
          onStartNew={clearDraft}
        />
      )}

      <PrivacyNote />
    </div>
  );
}

function Stepper({ current, onSelect, unlocked }: { current: StepId; onSelect: (id: StepId) => void; unlocked: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3 shadow-card">
      {STEPS.map((step, index) => {
        const isCurrent = step.id === current;
        const enabled = step.id === "add" || unlocked;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => enabled && onSelect(step.id)}
              disabled={!enabled}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                isCurrent
                  ? "bg-eo-purple text-white shadow-card"
                  : enabled
                    ? "text-slate-700 hover:bg-eo-lilac hover:text-eo-purple"
                    : "cursor-not-allowed text-slate-400"
              }`}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">{index + 1}</span>
              {step.label}
            </button>
            {index < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function AddStep(props: {
  csv: string;
  onCsvChange: (next: string) => void;
  onFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  parsedRows: number;
  parsedHeaders: number;
  parseErrors: { row: number; message: string }[];
  onContinue: () => void;
  onClear: () => void;
  summaries: ImportSummary[];
}) {
  const copySample = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(SAMPLE_CSV);
    }
  };
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forumflow-sample-import.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-eo-purple" />
          <div>
            <h2 className="text-base font-semibold text-ink">Add data</h2>
            <p className="mt-1 text-sm text-muted">
              Paste CSV text below or upload a .csv file. The preview and impact steps are required before committing real data.
              Unknown Forums, ambiguous statuses, duplicates, and missing fields are flagged before import.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => props.fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <Upload className="h-4 w-4" /> Upload .csv
          </button>
          <input
            ref={props.fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Upload CSV file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={copySample}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <ClipboardCopy className="h-4 w-4" /> Copy sample template
          </button>
          <button
            type="button"
            onClick={downloadSample}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-eo-purple"
          >
            <Download className="h-4 w-4" /> Download sample
          </button>
          <button
            type="button"
            onClick={props.onClear}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" /> Clear draft
          </button>
        </div>

        <textarea
          value={props.csv}
          onChange={(event) => props.onCsvChange(event.target.value)}
          rows={12}
          placeholder="Paste CSV here (first row should be headers)"
          aria-label="CSV data"
          className="mt-4 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
        />

        {props.parseErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            CSV parse warnings: {props.parseErrors.map((error) => `row ${error.row}: ${error.message}`).join("; ")}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Columns detected" value={props.parsedHeaders} />
          <Metric label="Data rows" value={props.parsedRows} />
          <Metric label="Required fields" value={REQUIRED_IMPORT_FIELDS.length} />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={props.onContinue}
            disabled={props.parsedRows === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to preview <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {props.summaries.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Recent imports</h2>
          <p className="mt-1 text-sm text-muted">Last {props.summaries.length} import{props.summaries.length === 1 ? "" : "s"} on this device.</p>
          <ul className="mt-4 divide-y divide-line">
            {props.summaries.map((summary) => (
              <li key={summary.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="text-slate-700">{new Date(summary.completedAt).toLocaleString()}</span>
                <span className="text-slate-500">
                  {summary.created} created · {summary.updated} updated · {summary.skipped} skipped
                  {summary.duplicateFlagged > 0 ? ` · ${summary.duplicateFlagged} duplicates flagged` : ""}
                  {summary.unknownForums > 0 ? ` · ${summary.unknownForums} unknown forums` : ""}
                </span>
                {summary.duplicateFlagged > 0 ? (
                  <Link href="/duplicate-review" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-eo-blue">
                    Open Duplicate Review
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function PreviewStep(props: {
  parsed: ParsedCsv;
  outcomes: RowOutcome[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const invalidCount = props.outcomes.filter((o) => o.invalidDob || o.missingRequired.length > 0 || !o.name).length;
  const showRows = props.parsed.rows.slice(0, 12);

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Preview parsed rows</h2>
          <p className="mt-1 text-sm text-muted">
            We auto-suggest field mapping in the next step. Use this preview to confirm the file parsed correctly.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Rows" value={props.parsed.rows.length} />
        <Metric label="Columns" value={props.parsed.headers.length} />
        <Metric label="Rows with issues" value={invalidCount} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Row</th>
              {props.parsed.headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {showRows.map((row, index) => (
              <tr key={`row-${props.parsed.rowNumbers[index]}`}>
                <td className="px-3 py-2 text-xs font-semibold text-slate-500">{props.parsed.rowNumbers[index]}</td>
                {row.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`} className="px-3 py-2 text-sm text-slate-700">
                    {cell || <span className="text-slate-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.parsed.rows.length > showRows.length && (
        <p className="mt-2 text-xs text-muted">Showing first {showRows.length} of {props.parsed.rows.length} rows.</p>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Continue to mapping <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function MappingStep(props: {
  headers: string[];
  mapping: FieldMapping;
  onChange: (next: FieldMapping) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const setField = (field: ImportField, header: string) => {
    const next = { ...props.mapping };
    if (header) next[field] = header;
    else delete next[field];
    props.onChange(next);
  };
  const fullNameMapped = !!props.mapping.fullName || (!!props.mapping.firstName && !!props.mapping.lastName);
  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => !props.mapping[field]);

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Map CSV columns to member fields</h2>
          <p className="mt-1 text-sm text-muted">
            We pre-filled likely matches. Adjust as needed. You don&apos;t need to map every field — required ones drive the readiness check.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <label key={field.id} className="rounded-lg border border-line bg-white p-3">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {field.label}
              {field.required && <span className="rounded-full bg-eo-pink/10 px-2 py-0.5 text-[10px] font-semibold text-eo-pink">Required</span>}
            </span>
            <select
              value={props.mapping[field.id] ?? ""}
              onChange={(event) => setField(field.id, event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
            >
              <option value="">— Not mapped —</option>
              {props.headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
          </label>
        ))}
      </div>

      {!fullNameMapped && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          Map either &quot;Full name&quot; or both &quot;First name&quot; and &quot;Last name&quot; — rows without a resolvable name will be skipped.
        </div>
      )}
      {missingRequired.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          Unmapped required fields: {missingRequired.map((field) => IMPORT_FIELDS.find((f) => f.id === field)?.label ?? field).join(", ")}.
          Rows missing values for these fields will land in Needs Info / Data Quality.
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Continue to impact summary <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function ImpactStep(props: {
  impact: ImportImpact;
  headers: string[];
  mappedFieldCount: number;
  unmappedHeaders: string[];
  outcomes: RowOutcome[];
  onUpdateAction: (rowNumber: number, action: RowAction) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 text-eo-purple" />
        <div>
          <h2 className="text-base font-semibold text-ink">Import impact</h2>
          <p className="mt-1 text-sm text-muted">Pre-flight check for real data. Review mapping, warnings, and row actions before committing.</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-line bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-ink">Pre-flight summary</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Rows detected" value={props.impact.totalRows} />
          <Metric label="Columns detected" value={props.headers.length} />
          <Metric label="Mapped fields" value={props.mappedFieldCount} />
          <Metric label="Unmapped columns" value={props.unmappedHeaders.length} />
        </div>
        {props.unmappedHeaders.length > 0 ? (
          <p className="mt-3 text-xs text-muted">Unmapped columns will be ignored: {props.unmappedHeaders.join(", ")}</p>
        ) : (
          <p className="mt-3 text-xs text-muted">All detected columns are mapped.</p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Will create" value={props.impact.toCreate} />
        <Metric label="Will update" value={props.impact.toUpdate} />
        <Metric label="Will skip" value={props.impact.toSkip} />
        <Metric label="Possible duplicates" value={props.impact.duplicateRows} />
        <Metric label="Missing required fields" value={props.impact.missingRequiredRows} />
        <Metric label="DOB/date issues" value={props.impact.invalidDobRows} />
        <Metric label="Number issues" value={props.impact.invalidNumberRows} />
        <Metric label="Unknown Forums" value={props.impact.unknownForumRows} />
        <Metric label="Status review" value={props.impact.statusReviewRows} />
        <Metric label="Needs relationship review" value={props.impact.needsRelationshipReviewRows} />
        <Metric label="Manual review rows" value={props.impact.manualReviewRows} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Row</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Name</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Company</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Flags</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {props.outcomes.map((outcome) => {
              const flags: string[] = [];
              if (outcome.duplicates.length > 0) flags.push("Possible duplicate");
              if (outcome.missingRequired.length > 0) flags.push(`Missing: ${outcome.missingRequired.join(", ")}`);
              if (outcome.invalidDob) flags.push(`Invalid DOB${outcome.invalidDobReason ? ` (${outcome.invalidDobReason})` : ""}`);
              if (outcome.invalidNumberFields.length > 0) flags.push(`Invalid number: ${outcome.invalidNumberFields.join(", ")}`);
              if (outcome.unknownForum) flags.push(`Unknown Forum${outcome.unknownForumName ? `: ${outcome.unknownForumName}` : ""}`);
              if (outcome.statusNeedsReview) flags.push(outcome.statusWarning ?? "Status needs review");
              if (outcome.relationshipReviewWarning) flags.push(outcome.relationshipReviewWarning);
              if (outcome.revenueWarning) flags.push(outcome.revenueWarning);
              if (outcome.needsRelationshipReview) flags.push("Needs relationship review");
              return (
                <tr key={outcome.rowNumber}>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-500">{outcome.rowNumber}</td>
                  <td className="px-3 py-2 text-sm text-ink">
                    {outcome.name || <span className="text-slate-400">Unnamed</span>}
                    {outcome.duplicates[0] && (
                      <Link href={`/members/${outcome.duplicates[0].id}`} className="ml-2 text-xs font-semibold text-eo-blue underline">
                        ({outcome.duplicates[0].name})
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700">{outcome.values.company || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {flags.length === 0 ? <span className="text-eo-teal">Clean</span> : flags.map((flag) => (
                      <span key={flag} className="mr-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{flag}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <select
                      value={outcome.action}
                      onChange={(event) => props.onUpdateAction(outcome.rowNumber, event.target.value as RowAction)}
                      className="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
                    >
                      <option value="create">Create new</option>
                      <option value="update" disabled={!outcome.matchedExistingId}>
                        Update existing{outcome.matchedExistingId ? "" : " (no match)"}
                      </option>
                      <option value="skip">Skip / Review later</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button type="button" onClick={props.onContinue} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2.5 text-sm font-semibold text-white shadow-card">
          Review and commit <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function CommitStep(props: {
  impact: ImportImpact;
  mappedFieldCount: number;
  unmappedHeaders: string[];
  outcomes: RowOutcome[];
  onBack: () => void;
  onCommit: () => void;
  result: ImportSummary | null;
  onStartNew: () => void;
}) {
  if (props.result) {
    return (
      <section className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-6 shadow-card">
        <CheckCircle2 className="h-8 w-8 text-eo-teal" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Import complete</h2>
        <p className="mt-2 text-sm text-slate-700">
          Created {props.result.created} · Updated {props.result.updated} · Skipped {props.result.skipped}
          {props.result.duplicateFlagged > 0 ? ` · ${props.result.duplicateFlagged} duplicates flagged` : ""}
          {props.result.unknownForums > 0 ? ` · ${props.result.unknownForums} unknown forums` : ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/members" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">View members</Link>
          <Link href="/data-quality" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">Open Data Quality</Link>
          <Link href="/placement-queue" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">Open Placement Queue</Link>
          <button type="button" onClick={props.onStartNew} className="ml-auto rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Start a new import</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink">Confirm import</h2>
      <p className="mt-1 text-sm text-muted">
        Review the impact summary one last time. Members will be created or updated immediately and the change will appear in Data Quality, Placement Queue, Members, and Forum Groups.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Will create" value={props.impact.toCreate} />
        <Metric label="Will update" value={props.impact.toUpdate} />
        <Metric label="Will skip" value={props.impact.toSkip} />
        <Metric label="Mapped fields" value={props.mappedFieldCount} />
        <Metric label="Unmapped columns" value={props.unmappedHeaders.length} />
        <Metric label="Manual review rows" value={props.impact.manualReviewRows} />
      </div>

      {props.impact.unknownForumRows > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {props.impact.unknownForumRows} row{props.impact.unknownForumRows === 1 ? "" : "s"} reference Forums that don&apos;t exist in the system. Those members will not be auto-assigned.
        </div>
      )}
      {props.impact.duplicateRows > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {props.impact.duplicateRows} possible duplicate{props.impact.duplicateRows === 1 ? "" : "s"} detected. Defaults skip them — change to &quot;Update existing&quot; or &quot;Create new&quot; in the impact step if you want to proceed.
        </div>
      )}
      {props.impact.statusReviewRows > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {props.impact.statusReviewRows} row{props.impact.statusReviewRows === 1 ? "" : "s"} include status values that need review. They will not be treated as clean placement-ready records automatically.
        </div>
      )}
      {props.impact.invalidDobRows > 0 || props.impact.invalidNumberRows > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          Date and number issues are flagged for Data Quality review after import.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button type="button" onClick={props.onBack} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink">
          Back
        </button>
        <button
          type="button"
          onClick={props.onCommit}
          disabled={props.impact.toCreate === 0 && props.impact.toUpdate === 0 && props.impact.duplicateRows === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-eo-pink px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          Commit import
        </button>
      </div>
    </section>
  );
}
