"use client";

import { Download } from "lucide-react";
import { localPlacementStorageKey, parseLocalPlacementDecisions } from "@/lib/local-placements";

export function ExportReportButton({ report }: { report: string }) {
  const exportReport = () => {
    const localPlacements = parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey));
    const localSection = localPlacements.length
      ? [
          "",
          "Local placement decisions",
          "",
          ...localPlacements.map((placement) => `${placement.status}: ${placement.memberName} -> ${placement.forumName}`)
        ].join("\n")
      : "";
    const blob = new Blob([`${report}${localSection}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forum-placement-report.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded-lg bg-eo-blue px-4 py-2.5 text-sm font-semibold text-white">
      <Download className="h-4 w-4" />
      Export report
    </button>
  );
}
