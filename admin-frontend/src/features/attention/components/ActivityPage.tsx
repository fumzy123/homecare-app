import { useState } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { useActivity } from "../hooks/useActivity";
import "../tower.css";

export function ActivityPage() {
  const [scope, setScope] = useState<"mine" | "agency">("mine");
  const [kind, setKind] = useState<"completed" | "all">("completed");
  const [day, setDay] = useState<string | null>(null);
  const context = useActivity({ scope: "mine", kind: "completed" });
  const today = context.data?.pages[0]?.today;
  const selectedDay = day ?? today;
  return (
    <div className="activity-page">
      <div className="activity-heading">
        <div>
          <p className="tower-kicker">Your day, recorded</p>
          <h1>
            Activity<span>.</span>
          </h1>
          <p className="text-ink-soft">
            The care you moved forward. The details you took care of.
          </p>
        </div>
      </div>
      <div className="activity-controls">
        <div className="tower-segments" aria-label="Activity scope">
          {(["mine", "agency"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={scope === value}
              onClick={() => setScope(value)}
            >
              {value === "mine" ? "My activity" : "Agency activity"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="activity-day">
            Activity date
          </label>
          <input
            id="activity-day"
            type="date"
            value={selectedDay ?? ""}
            onChange={(e) => setDay(e.target.value || null)}
          />
          <button className="tower-link" onClick={() => setDay(null)}>
            Today
          </button>
        </div>
      </div>
      <section className="activity-paper" aria-label="Activity history">
        <header>
          <h2>
            {selectedDay === today ? "Today’s progress" : "Recorded progress"}
          </h2>
          <label className="sr-only" htmlFor="activity-kind">
            Activity type
          </label>
          <select
            id="activity-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="completed">Completed actions</option>
            <option value="all">Actions & updates</option>
          </select>
        </header>
        {selectedDay ? (
          <ActivityFeed filters={{ scope, kind, day: selectedDay }} />
        ) : (
          <p role="status" className="p-6">
            {context.isError ? "Could not load the agency date." : "Loading…"}
            {context.isError && (
              <button
                className="ml-2 underline"
                onClick={() => void context.refetch()}
              >
                Retry
              </button>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
