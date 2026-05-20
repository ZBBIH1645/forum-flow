import Link from "next/link";
import { ClipboardList, FileText } from "lucide-react";

export function PlacementReviewFallback() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-line bg-white p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-eo-purple">Legacy page</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Placement Review</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Placement review items now live in Placement Queue and Reports.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/placement-queue" className="inline-flex items-center gap-2 rounded-lg bg-eo-purple px-4 py-2 text-sm font-semibold text-white">
            <ClipboardList className="h-4 w-4" /> Go to Placement Queue
          </Link>
          <Link href="/reports" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
            <FileText className="h-4 w-4" /> Go to Reports
          </Link>
        </div>
      </div>
    </div>
  );
}
