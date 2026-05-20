import { ImportDataWizard } from "@/components/import-data-wizard";

export const metadata = {
  title: "Import Data · Forum Placement Dashboard"
};

export default function ImportDataPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Forum Placement Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Import Data</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Bring legacy member records into the dashboard. Paste a CSV or upload a file, map your columns to member fields,
          review the impact, then commit. Imported members flow into Members, Data Quality, Placement Queue, and Forum Groups.
        </p>
      </header>
      <ImportDataWizard />
    </div>
  );
}
