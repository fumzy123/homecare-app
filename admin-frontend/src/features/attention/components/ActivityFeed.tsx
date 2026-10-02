import { Check, ArrowUpRight } from "lucide-react";
import {
  useActivity,
  useReadActivity,
  type ActivityFilters,
} from "../hooks/useActivity";
import { useAttention } from "../hooks/useAttention";
import { categoryLabels } from "../types";

// Layer 3: history retrieval, read state and navigation; shared by Tower and Activity.
export function ActivityFeed({
  filters,
  compact = false,
}: {
  filters: ActivityFilters;
  compact?: boolean;
}) {
  const query = useActivity(filters);
  const read = useReadActivity();
  const { onTarget } = useAttention();
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const timezone = query.data?.pages[0]?.timezone;
  if (query.isPending)
    return (
      <p role="status" className="p-6 text-sm text-ink-soft">
        Loading activity…
      </p>
    );
  if (query.isError)
    return (
      <div role="alert" className="p-6 text-sm">
        Could not load activity.{" "}
        <button className="underline" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="tower-activity">
      {entries.some((e) => e.unread) && (
        <div className="tower-feed-tools">
          <button
            disabled={read.isPending}
            onClick={() => read.mutate(entries)}
          >
            {read.isPending ? "Saving…" : "Mark displayed updates as seen"}
          </button>
        </div>
      )}
      {read.isError && (
        <p role="alert" className="p-4 text-sm">
          Could not save read status. Please try again.
        </p>
      )}
      {!entries.length && (
        <div className="tower-empty">
          <Check size={22} />
          <p>
            {filters.kind === "completed"
              ? "Your completed actions will appear here."
              : "No activity to show yet."}
          </p>
        </div>
      )}
      <ol className="tower-timeline">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span
              className={`tower-event-icon ${entry.kind}`}
              aria-hidden="true"
            >
              {entry.kind === "completed" ? (
                <Check size={14} />
              ) : (
                <span>•</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="tower-event-label">
                {entry.kind === "completed" ? "Completed action" : "Update"}
                {entry.unread && <span className="tower-new">New</span>}
              </div>
              <p className="tower-event-title">{entry.title}</p>
              {entry.detail && <p className="tower-detail">{entry.detail}</p>}
              <p className="tower-event-meta">
                {entry.kind === "completed"
                  ? `${entry.mine ? "You" : (entry.actor ?? "Agency")} · `
                  : ""}
                {new Intl.DateTimeFormat("en-CA", {
                  timeZone: timezone,
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(entry.created_at))}
                {!compact && ` · ${categoryLabels[entry.category]}`}
              </p>
              {entry.target && (
                <button
                  className="tower-link"
                  onClick={() => {
                    if (entry.unread) read.mutate([entry]);
                    onTarget(entry.target!);
                  }}
                >
                  View details <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {query.hasNextPage && (
        <button
          className="tower-load"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Earlier activity"}
        </button>
      )}
    </div>
  );
}
