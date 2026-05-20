import type { MemberStatus } from "@/lib/types";

const styles: Record<MemberStatus, string> = {
  "New Member": "bg-violet-50 text-violet-800 ring-violet-200",
  "Free Agent": "bg-sky-50 text-sky-800 ring-sky-200",
  "In Forum": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Needs Info": "bg-amber-50 text-amber-900 ring-amber-200",
  "Needs Conflict Review": "bg-orange-50 text-orange-800 ring-orange-200",
  "Ready To Assign": "bg-blue-50 text-blue-800 ring-blue-200",
  Shortlisted: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  "Pending Approval": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Assigned / Pending Forum Review": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Rejected: "bg-red-50 text-red-800 ring-red-200",
  "Assignment Expired": "bg-rose-50 text-rose-800 ring-rose-200",
  Placed: "bg-teal-50 text-teal-800 ring-teal-200",
  "On Hold": "bg-slate-100 text-slate-700 ring-slate-200",
  "Former Member": "bg-zinc-100 text-zinc-700 ring-zinc-200"
};

const labels: Partial<Record<MemberStatus, string>> = {
  "Assigned / Pending Forum Review": "Assigned",
  "Pending Approval": "Assigned",
  Placed: "In Forum"
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span title={status} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>
      {labels[status] ?? status}
    </span>
  );
}
