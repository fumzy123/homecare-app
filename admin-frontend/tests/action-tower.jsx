/* Isolated sample host for the production Tower components. No auth or business API calls. */
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { apiClient } from "../src/shared/lib/api-client";
import { AttentionProvider } from "../src/features/attention/components/AttentionProvider";
import { DashboardAttention } from "../src/features/attention/components/DashboardAttention";
import { ActivityPage } from "../src/features/attention/components/ActivityPage";
import { OvertimeReviewDrawer } from "../src/features/shifts/components/OvertimeReviewDrawer";
import { Sidebar } from "../src/shared/components/layout/Sidebar";
import "../src/index.css";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = (kind, n) => ({
  kind,
  record_id: id(n),
  detail_id: null,
  document_type: null,
  occurrence_date: null,
});
const now = () => new Date().toISOString();
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/St_Johns",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
let feed = [
  {
    id: "care:" + id(1),
    category: "coverage",
    stage: "review_interest",
    urgency: "review",
    subject: "Margaret Bennett",
    detail: "2 interested workers · 4 open care slots",
    due_on: day,
    covered_slots: 3,
    total_slots: 7,
    unread_count: 1,
    notification_ids: [id(31)],
    target: target("placement", 1),
    interested_workers: [
      {
        id: id(11),
        name: "Sophie Williams",
        slots: ["Mon 09:00–11:00", "Wed 09:00–11:00"],
        unread: false,
      },
      {
        id: id(12),
        name: "Daniel Chen",
        slots: ["Tue 09:00–11:00", "Thu 09:00–11:00"],
        unread: true,
      },
    ],
  },
  {
    id: "visit:" + id(2),
    category: "schedule",
    stage: "replace_worker",
    urgency: "urgent",
    subject: "Robert Ellis",
    detail: "Friday afternoon visit · Replacement needed",
    due_on: day,
    target: target("visit", 2),
  },
  {
    id: "notice:" + id(3),
    category: "schedule",
    stage: "review_overtime",
    urgency: "review",
    subject: "Overtime approval",
    detail: "Jane Doe · Requested visit",
    due_on: null,
    target: target("overtime", 3),
  },
  {
    id: "credential:" + id(4),
    category: "credentials",
    stage: "verify_credential",
    urgency: "review",
    subject: "Amelia Foster",
    detail: "First Aid / CPR uploaded",
    due_on: null,
    target: { ...target("credential", 4), document_type: "first_aid_cpr" },
  },
  {
    id: "care:" + id(5),
    category: "coverage",
    stage: "await_interest",
    urgency: "waiting",
    subject: "Jane Doe",
    detail: "3 open care slots · Awaiting worker interest",
    due_on: null,
    target: target("placement", 5),
  },
];
let entries = [
  {
    id: "notice:" + id(31),
    situation_key: "care:" + id(1),
    category: "coverage",
    kind: "update",
    title: "Daniel Chen expressed interest",
    detail: "Tuesday and Thursday · 09:00–11:00",
    actor: null,
    mine: false,
    created_at: now(),
    unread: true,
    target: target("placement", 1),
  },
  {
    id: "event:" + id(32),
    situation_key: "care:" + id(1),
    category: "coverage",
    kind: "completed",
    title: "Approved 3 care slots",
    detail: "Margaret Bennett · 4 slots remaining",
    actor: "Alex Morgan",
    mine: true,
    created_at: now(),
    unread: false,
    target: target("placement", 1),
  },
  {
    id: "event:" + id(33),
    situation_key: "credential:" + id(6),
    category: "credentials",
    kind: "completed",
    title: "Verified credential",
    detail: "Daniel Chen · First Aid / CPR",
    actor: "Alex Morgan",
    mine: true,
    created_at: now(),
    unread: false,
    target: { ...target("credential", 6), document_type: "first_aid_cpr" },
  },
  {
    id: "event:" + id(34),
    situation_key: "authorization:" + id(7),
    category: "authorizations",
    kind: "completed",
    title: "Amended funding authorization",
    detail: "Jane Doe · Renewed through December",
    actor: "Amara Wilson",
    mine: false,
    created_at: now(),
    unread: false,
    target: { ...target("authorization", 7), detail_id: id(8) },
  },
];
let overtime = {
  id: id(3),
  type: "overtime_approval_requested",
  about_worker_first_name: "Daniel",
  about_worker_last_name: "Chen",
  resolved_at: null,
  can_decide: true,
  request_status: "pending",
  created_at: now(),
  payload: {
    requesting_member_name: "Amara Wilson",
    client_name: "Jane Doe",
    client_id: id(7),
    start_time: day + "T09:00:00",
    end_time: day + "T11:00:00",
    week_start: day,
    week_end: day,
    total_hours: 42,
    is_recurring: false,
  },
};
const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
apiClient.interceptors.request.clear();
apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async (config) => {
  let data;
  if (config.url === "/api/attention-items")
    data = {
      org_id: id(100),
      checked_at: now(),
      week_start: day,
      week_end: day,
      items: feed,
      unread_count: entries.filter((e) => e.unread).length,
    };
  else if (config.url === "/api/activity") {
    const p = config.params || {};
    data = {
      today: day,
      timezone: "America/St_Johns",
      next_cursor: null,
      entries: entries.filter(
        (e) =>
          (!p.situation || e.situation_key === p.situation) &&
          (!p.day || p.day === day) &&
          (p.scope !== "mine" || e.mine) &&
          (p.kind !== "completed" || e.kind === "completed"),
      ),
    };
  } else if (config.url === "/api/activity/read") {
    const p = JSON.parse(config.data);
    entries = entries.map((e) => ({
      ...e,
      unread:
        e.unread &&
        !p.event_ids.includes(e.id.slice(6)) &&
        !p.notification_ids.includes(e.id.slice(7)),
    }));
    feed = feed.map((i) => ({
      ...i,
      unread_count: entries.filter((e) => e.situation_key === i.id && e.unread)
        .length,
      interested_workers: i.interested_workers?.map((w) => ({
        ...w,
        unread: w.unread && !p.notification_ids.includes(id(31)),
      })),
    }));
    data = { ok: true };
  } else if (config.url.startsWith("/api/shifts/overtime-requests/"))
    data = overtime;
  else if (
    config.url === "/api/shifts/approve-overtime" ||
    config.url === "/api/shifts/reject-overtime"
  ) {
    const approved = config.url.includes("approve");
    overtime = {
      ...overtime,
      resolved_at: now(),
      request_status: approved ? "approved" : "rejected",
    };
    feed = feed.filter((i) => i.stage !== "review_overtime");
    entries.unshift({
      id: "event:" + id(40),
      situation_key: "notice:" + id(3),
      category: "schedule",
      kind: "completed",
      title: approved ? "Overtime approved" : "Overtime rejected",
      detail: "Jane Doe",
      actor: "Alex Morgan",
      mine: true,
      created_at: now(),
      unread: false,
      target: target("overtime", 3),
    });
    data = { ok: true };
  } else throw new Error("Unhandled sample endpoint " + config.url);
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
function Shell() {
  return (
    <AttentionProvider userId="fixture">
      <div className="flex h-screen bg-cream text-ink">
        <Sidebar open={false} onClose={() => {}} />
        <div className="flex flex-1 flex-col min-w-0">
          <div className="border-b border-ink px-6 py-4 flex justify-between font-mono text-[10px]">
            <span>HMCR-2026 / ADMIN CONSOLE</span>
            <span>ISOLATED SAMPLE DATA · PRODUCTION COMPONENTS</span>
          </div>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <OvertimeReviewDrawer />
      </div>
    </AttentionProvider>
  );
}
function Dashboard() {
  return (
    <div className="p-10">
      <p className="font-mono text-[10px] tracking-widest">
        FRIDAY / AGENCY WORKSPACE
      </p>
      <h1 className="font-serif text-5xl mt-3 mb-8">Care, moving forward.</h1>
      <div className="grid lg:grid-cols-[minmax(350px,520px)_1fr] gap-8">
        <DashboardAttention />
        <section className="border-t border-ink p-6">
          <h2 className="font-serif text-3xl mb-3">
            One place to keep moving.
          </h2>
          <p className="text-sm text-ink-soft leading-7">
            Open a situation to review its workers and history. Completed steps
            appear in Activity.
          </p>
          <Link className="tower-link mt-5" to="/dashboard/activity">
            View today's activity
          </Link>
        </section>
      </div>
    </div>
  );
}
function SampleWorkflow() {
  return (
    <div className="p-10">
      <Link to="/dashboard" className="tower-link">
        Back to your work
      </Link>
      <h1 className="font-serif text-4xl my-6">Margaret's care coverage</h1>
      <p className="mb-6">
        Sample outcome controls for verifying the Tower state.
      </p>
      <button
        className="tower-primary"
        onClick={() => {
          feed = feed.filter((i) => i.id !== "care:" + id(1));
          entries.unshift({
            id: "event:" + id(50),
            situation_key: "care:" + id(1),
            category: "coverage",
            kind: "completed",
            title: "Completed care coverage",
            detail: "Margaret Bennett · All 7 slots covered",
            actor: "Alex Morgan",
            mine: true,
            created_at: now(),
            unread: false,
            target: target("placement", 1),
          });
          qc.invalidateQueries({ queryKey: ["attention-items"] });
          qc.invalidateQueries({ queryKey: ["activity"] });
        }}
      >
        Simulate coverage completed
      </button>
    </div>
  );
}
const root = createRootRoute({ component: Shell });
const dashboard = createRoute({
  getParentRoute: () => root,
  path: "/dashboard",
  component: Dashboard,
});
const activity = createRoute({
  getParentRoute: () => root,
  path: "/dashboard/activity",
  component: ActivityPage,
});
const placement = createRoute({
  getParentRoute: () => root,
  path: "/dashboard/placements/$placementId",
  component: SampleWorkflow,
});
const fallback = createRoute({
  getParentRoute: () => root,
  path: "$",
  component: SampleWorkflow,
});
const router = createRouter({
  routeTree: root.addChildren([dashboard, activity, placement, fallback]),
  history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
});
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={qc}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
