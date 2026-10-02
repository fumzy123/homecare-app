import { useState } from "react";
import { ArrowUpRight, ChevronDown, Check, Clock3 } from "lucide-react";
import type { AttentionItem, AttentionCategory } from "../types";
import { actionLabels, categoryLabels } from "../types";
import { ActivityFeed } from "./ActivityFeed";
import "../tower.css";

interface Props {
  actionError?: string;
  items: AttentionItem[];
  loading: boolean;
  error: boolean;
  selectedId: string | null;
  expanded: string[];
  onExpanded: (id: string, open: boolean) => void;
  onSelect: (item: AttentionItem) => void;
  onRetry: () => void;
  unreadCount?: number;
}
const order: AttentionCategory[] = [
  "coverage",
  "schedule",
  "workers",
  "credentials",
  "clients",
  "authorizations",
  "documentation",
  "billing",
];

// Controlled workflow cards. History delegates data ownership to ActivityFeed.
export function AttentionList({
  actionError,
  items,
  loading,
  error,
  selectedId,
  expanded,
  onExpanded,
  onSelect,
  onRetry,
  unreadCount = 0,
}: Props) {
  const [view, setView] = useState<"work" | "updates">("work");
  const [history, setHistory] = useState<string | null>(null);
  const actions = items.filter(
    (i) => i.urgency !== "waiting" && i.action_required !== false,
  ).length;
  return (
    <div className="tower-body">
      {actionError && (
        <p role="alert" className="p-5 text-sm">
          {actionError}
        </p>
      )}
      <div className="tower-tabs" aria-label="Action Tower views">
        <button aria-pressed={view === "work"} onClick={() => setView("work")}>
          Your work <span>{actions}</span>
        </button>
        <button
          aria-pressed={view === "updates"}
          onClick={() => setView("updates")}
        >
          Recent activity{" "}
          {unreadCount > 0 && (
            <span className="tower-unread-count">{unreadCount}</span>
          )}
        </button>
      </div>
      {view === "updates" ? (
        <ActivityFeed filters={{ scope: "agency" }} compact />
      ) : (
        <>
          {loading ? (
            <p role="status" className="p-6 text-sm">
              Checking your work…
            </p>
          ) : error ? (
            <div role="alert" className="p-6 text-sm">
              Could not refresh your work.{" "}
              <button className="underline" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="tower-summary">
                <span>
                  {actions
                    ? `${actions} situation${actions === 1 ? "" : "s"} need attention`
                    : "No actions in the current checks"}
                </span>
                {items.some((i) => i.urgency === "waiting") && (
                  <span>
                    <Clock3 size={12} />{" "}
                    {items.filter((i) => i.urgency === "waiting").length}{" "}
                    waiting
                  </span>
                )}
              </div>
              {!items.length && (
                <div className="tower-empty">
                  <Check size={25} />
                  <p>You’re up to date with these checks.</p>
                  <button
                    className="tower-link"
                    onClick={() => setView("updates")}
                  >
                    See recent progress <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {order.map((category) => {
                const members = items.filter((i) => i.category === category);
                if (!members.length) return null;
                const open = expanded.includes(category);
                const newCount = members.reduce(
                  (total, item) => total + (item.unread_count ?? 0),
                  0,
                );
                return (
                  <section className="tower-category" key={category}>
                    <button
                      className="tower-category-heading"
                      aria-expanded={open}
                      onClick={() => onExpanded(category, !open)}
                    >
                      <span>
                        {categoryLabels[category]}
                        {newCount > 0 && <small>{newCount} new</small>}
                      </span>
                      <span className="tower-category-count">
                        {members.length}
                        <ChevronDown
                          size={15}
                          className={open ? "rotate-180" : ""}
                        />
                      </span>
                    </button>
                    {open && (
                      <div className="tower-cards">
                        {members.map((item) => (
                          <article
                            key={item.id}
                            className={`tower-card ${item.urgency} ${selectedId === item.id ? "selected" : ""}`}
                          >
                            <div className="tower-card-top">
                              <span className="tower-state">
                                {item.action_required === false
                                  ? "Update"
                                  : item.urgency === "waiting"
                                    ? "Waiting"
                                    : item.urgency === "urgent"
                                      ? "Needs attention"
                                      : "Next step"}
                              </span>
                              {(item.unread_count ?? 0) > 0 && (
                                <span className="tower-new">
                                  {item.unread_count} new
                                </span>
                              )}
                            </div>
                            <h3>{item.subject}</h3>
                            <p className="tower-detail">{item.detail}</p>
                            {item.due_on && (
                              <p className="tower-date">
                                {new Intl.DateTimeFormat("en-CA", {
                                  month: "short",
                                  day: "numeric",
                                }).format(new Date(item.due_on + "T12:00:00"))}
                              </p>
                            )}
                            {item.total_slots != null && (
                              <div className="tower-coverage">
                                <div>
                                  <span>Care slots covered</span>
                                  <strong>
                                    {item.covered_slots ?? 0} /{" "}
                                    {item.total_slots}
                                  </strong>
                                </div>
                                <progress
                                  value={item.covered_slots ?? 0}
                                  max={item.total_slots || 1}
                                  aria-label="Care slots covered"
                                />
                              </div>
                            )}
                            {!!item.interested_workers?.length && (
                              <ul className="tower-workers">
                                {item.interested_workers.map((worker) => (
                                  <li key={worker.id}>
                                    <span className="tower-avatar">
                                      {worker.name
                                        .split(" ")
                                        .map((part) => part[0])
                                        .slice(0, 2)
                                        .join("")}
                                    </span>
                                    <div>
                                      <p>
                                        {worker.name}
                                        {worker.unread && (
                                          <span className="tower-new">New</span>
                                        )}
                                      </p>
                                      <p className="tower-detail">
                                        {worker.slots.join(" · ")}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="tower-card-actions">
                              <button
                                className="tower-primary"
                                onClick={() => onSelect(item)}
                              >
                                {actionLabels[item.stage]}
                                <ArrowUpRight size={14} />
                              </button>
                              <button
                                className="tower-link"
                                aria-expanded={history === item.id}
                                onClick={() =>
                                  setHistory(
                                    history === item.id ? null : item.id,
                                  )
                                }
                              >
                                History
                              </button>
                            </div>
                            {history === item.id && (
                              <div className="tower-card-history">
                                <ActivityFeed
                                  filters={{ situation: item.id }}
                                  compact
                                />
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              <details className="tower-checks">
                <summary>What’s included</summary>
                <p>
                  Care coverage, dropped visits, credentials, funding renewals,
                  overtime and billing alerts. Updates and completed actions are
                  retained in Recent activity. Date-based checks are a review
                  aid, not a complete compliance audit.
                </p>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
