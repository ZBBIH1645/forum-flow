import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "brand"
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "brand" | "amber" | "blue" | "slate";
}) {
  const toneClass = {
    brand: "bg-eo-blue/10 text-eo-blue",
    amber: "bg-eo-orange/15 text-orange-800",
    blue: "bg-eo-pink/10 text-eo-pink",
    slate: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">{detail}</p>
    </div>
  );
}
