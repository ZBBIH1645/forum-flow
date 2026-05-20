"use client";

import { ForumBadge } from "./forum-badge";
import { useLiveData } from "./live-data-provider";

export function ForumLegend({
  selectedForumId,
  onSelectForum,
  limit = 24
}: {
  selectedForumId?: string;
  onSelectForum?: (forumId: string | null) => void;
  limit?: number;
}) {
  const { forums } = useLiveData();
  const visibleForums = forums.slice(0, limit);
  const interactive = Boolean(onSelectForum);

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Forum color legend</h2>
          <p className="mt-1 text-xs text-muted">Each Forum keeps the same color across the app.</p>
        </div>
        {interactive && selectedForumId ? (
          <button type="button" onClick={() => onSelectForum?.(null)} className="text-xs font-semibold text-eo-blue hover:text-eo-purple">
            Clear Forum filter
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleForums.map((forum) => {
          const active = selectedForumId === forum.id;
          if (!interactive) {
            return <ForumBadge key={forum.id} forumId={forum.id} name={forum.name} href={`/forums/${forum.id}`} size="xs" />;
          }
          return (
            <button
              key={forum.id}
              type="button"
              onClick={() => onSelectForum?.(active ? null : forum.id)}
              className={`rounded-full transition ${active ? "ring-2 ring-eo-purple ring-offset-2" : "hover:brightness-95"}`}
            >
              <ForumBadge forumId={forum.id} name={forum.name} size="xs" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
