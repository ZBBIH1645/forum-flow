import type { CompatibilityLabel } from "@/lib/types";

const styles: Record<CompatibilityLabel, string> = {
  "Best Fit": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Good Fit": "bg-sky-50 text-sky-800 ring-sky-200",
  "Possible Fit": "bg-slate-100 text-slate-700 ring-slate-200",
  "Needs Review": "bg-amber-50 text-amber-900 ring-amber-200",
  Blocked: "bg-red-50 text-red-800 ring-red-200"
};

export function CompatibilityBadge({ label }: { label: CompatibilityLabel }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[label]}`}>{label}</span>;
}
