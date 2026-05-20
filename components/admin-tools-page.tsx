"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clipboard, Database, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { PrivacyNote } from "./privacy-note";
import { useLiveData, type LocalDataBackup } from "./live-data-provider";

const checklist = [
  "Open Dashboard",
  "Open Placement Queue",
  "Show Needs Info member",
  "Show Data Quality",
  "Show Shortlist Board",
  "Compare candidates for a Forum",
  "Assign a member to a Forum",
  "Show Assigned / Pending Forum Review",
  "Confirm member as In Forum",
  "Reject another member and return to Free Agent",
  "Show Reports",
  "Show Intake form",
  "Show Import Data",
  "Show Duplicate Review"
];

const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleString() : "Never";

export function AdminToolsPage() {
  const data = useLiveData();
  const { getLocalDataStatus } = data;
  const [backupText, setBackupText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState({
    changedMembers: 0,
    relationships: 0,
    activityEvents: 0,
    localPlacementDecisions: 0,
    importSummaries: 0,
    duplicateCases: 0
  });

  useEffect(() => {
    setStatus(getLocalDataStatus());
  }, [data.members.length, data.relationships.length, data.activity.length, data.localPlacements.length, data.importSummaries.length, data.duplicateCases.length, getLocalDataStatus]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      showToast(message.replace("copied", "ready"));
    }
  };

  const exportJson = () => {
    const backup = data.exportLocalData();
    const text = JSON.stringify(backup, null, 2);
    setBackupText(text);
    copy(text, "Local data backup copied");
  };

  const importJson = () => {
    if (!backupText.trim()) {
      showToast("Paste a JSON backup first.");
      return;
    }
    if (!window.confirm("Import this JSON backup? This replaces current local demo changes, including assignments, imports, duplicate review state, and activity history.")) return;
    try {
      const parsed = JSON.parse(backupText) as LocalDataBackup;
      data.importLocalData(parsed);
      showToast("Local JSON backup imported.");
    } catch {
      showToast("Could not parse JSON backup.");
    }
  };

  const reset = () => {
    if (!window.confirm("Reset to demo data? This clears local member edits, assignments, imports, duplicate review state, and activity changes, then restores the built-in demo set.")) return;
    data.resetToDemoData();
    showToast("Reset to demo data.");
  };

  const clearLocal = () => {
    if (!window.confirm("Clear all local changes? This removes browser-saved edits, assignments, imports, duplicate review state, and activity changes. Built-in demo data remains available.")) return;
    data.clearLocalChanges();
    showToast("Local changes cleared.");
  };

  const checklistText = checklist.map((item, index) => `${index + 1}. ${item}`).join("\n");

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Demo controls</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Admin Tools</h1>
          <p className="mt-2 text-sm text-muted">Reset local demo state, preserve backups, and keep the walkthrough predictable.</p>
        </div>
        <Link href="/reports" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-card">Open Reports</Link>
      </header>

      {toast ? <div className="rounded-lg border border-eo-teal/30 bg-eo-teal/10 p-3 text-sm font-semibold text-eo-teal">{toast}</div> : null}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-card">
        <p className="text-sm font-semibold text-amber-950">Demo/admin use only</p>
        <p className="mt-1 text-sm text-amber-900">These actions affect browser localStorage only. They do not create backend accounts, roles, emails, or public admin access.</p>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-eo-purple" />
              <h2 className="text-base font-semibold text-ink">Real Data Readiness</h2>
            </div>
            <p className="mt-2 text-sm text-muted">Demo data is active. Before using real chapter data, export a backup, run an import preview, review duplicate and unknown Forum warnings, then check Data Quality and Placement Queue.</p>
            <p className="mt-2 text-xs text-muted">Reset to Demo Data restores the polished fake dataset. Clear Local Changes removes browser-saved edits and imports.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/import-data" className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-3 py-2 text-sm font-semibold text-white">
              <Upload className="h-4 w-4" /> Go to Import Data
            </Link>
            <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <Download className="h-4 w-4" /> Export current backup
            </button>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <RotateCcw className="h-4 w-4" /> Reset to demo data
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-eo-purple" />
            <h2 className="text-base font-semibold text-ink">Local Data Status</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(status).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-line bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{key.replace(/([A-Z])/g, " $1")}</p>
                <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted">
            <p>Last reset: {formatDate(data.demoTools.lastResetAt)}</p>
            <p>Last clear: {formatDate(data.demoTools.lastClearedAt)}</p>
            <p>Last export: {formatDate(data.demoTools.lastExportAt)}</p>
            <p>Last import: {formatDate(data.demoTools.lastImportAt)}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2 text-sm font-semibold text-white">
              <RotateCcw className="h-4 w-4" /> Reset to demo data
            </button>
            <button type="button" onClick={clearLocal} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
              Clear local changes
            </button>
            <button type="button" onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
              <Download className="h-4 w-4" /> Export JSON
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Import / Export Backup</h2>
            <button type="button" onClick={importJson} className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
              <Upload className="h-3.5 w-3.5" /> Import pasted JSON
            </button>
          </div>
          <textarea
            value={backupText}
            onChange={(event) => setBackupText(event.target.value)}
            rows={13}
            className="mt-4 w-full rounded-lg border border-line bg-slate-50 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-eo-blue focus:ring-2 focus:ring-eo-blue/10"
            placeholder="Exported JSON backup will appear here, or paste a backup to import."
          />
        </section>
      </div>

      <section className="rounded-lg border border-line bg-white p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-ink">Demo Walkthrough Checklist</h2>
          <button type="button" onClick={() => copy(checklistText, "Demo checklist copied")} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
            <Clipboard className="h-3.5 w-3.5" /> Copy checklist
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {checklist.map((item) => (
            <label key={item} className="flex items-center gap-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-line text-eo-purple" />
              {item}
            </label>
          ))}
        </div>
      </section>

      <PrivacyNote />
    </div>
  );
}
