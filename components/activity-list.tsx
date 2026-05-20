"use client";

import { useLiveData } from "./live-data-provider";

export function ActivityList() {
  const { activity } = useLiveData();
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">Activity history</h2>
      {activity.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No local member or placement activity yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {activity.slice(0, 8).map((event) => (
            <div key={event.id} className="rounded-lg border border-line bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{event.type}</p>
                <p className="text-xs text-muted">{new Date(event.createdAt).toLocaleDateString()}</p>
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-700">{event.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
