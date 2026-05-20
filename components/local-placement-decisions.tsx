"use client";

import { useEffect, useMemo, useState } from "react";
import { ForumBadge } from "./forum-badge";
import { localPlacementStorageKey, localPlacementUpdatedEvent, parseLocalPlacementDecisions, type LocalPlacementDecision } from "@/lib/local-placements";

export function LocalPlacementDecisions({
  forumId,
  title = "Placement decisions"
}: {
  forumId?: string;
  title?: string;
}) {
  const [decisions, setDecisions] = useState<LocalPlacementDecision[]>([]);

  useEffect(() => {
    const loadDecisions = () => {
      setDecisions(parseLocalPlacementDecisions(window.localStorage.getItem(localPlacementStorageKey)));
    };

    loadDecisions();
    window.addEventListener(localPlacementUpdatedEvent, loadDecisions);
    window.addEventListener("storage", loadDecisions);
    return () => {
      window.removeEventListener(localPlacementUpdatedEvent, loadDecisions);
      window.removeEventListener("storage", loadDecisions);
    };
  }, []);

  const visibleDecisions = useMemo(
    () => decisions.filter((decision) => !forumId || decision.forumId === forumId),
    [decisions, forumId]
  );

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {visibleDecisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No local placement decisions recorded yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDecisions.map((decision) => (
            <div key={`${decision.memberId}-${decision.createdAt}`} className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{decision.memberName}</p>
                  <div className="mt-1">
                    <ForumBadge forumId={decision.forumId} name={decision.forumName} size="xs" />
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClassName(decision.status)}`}>
                  {decision.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted">{decision.note || "Reflected across the local placement workflow."}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusClassName(status: LocalPlacementDecision["status"]) {
  if (status === "Confirmed" || status === "Approved" || status === "Placed") return "bg-eo-teal/10 text-eo-teal";
  if (status === "Assigned") return "bg-indigo-100 text-indigo-800";
  if (status === "Shortlisted") return "bg-eo-pink/10 text-eo-pink";
  if (status === "Needs Review") return "bg-amber-100 text-amber-800";
  if (status === "Returned") return "bg-slate-100 text-slate-700";
  return "bg-red-50 text-red-700";
}
