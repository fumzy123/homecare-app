import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { ListChecks, Minus } from "lucide-react";
import { useAttentionItems } from "../hooks/useAttentionItems";
import { attentionDestination } from "../navigation";
import { useReadActivity } from "../hooks/useActivity";
import { useOpenOvertime } from "../hooks/useOpenOvertime";
import type { AttentionItem } from "../types";
import { AttentionList } from "./AttentionList";
import {
  AttentionContext,
  type AttentionContextValue,
} from "../hooks/useAttention";
// Layer 3: one subscription and state owner across admin routes.
export function AttentionProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const query = useAttentionItems(userId);
  const overtime = useOpenOvertime();
  const read = useReadActivity();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const dashboard = pathname.replace(/\/$/, "") === "/dashboard";
  const [expanded, setExpanded] = useState<string[]>(["coverage", "schedule"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [obscured, setObscured] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const minimizer = useRef<HTMLButtonElement>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setOpen(false);
  }
  // Existing workflows invalidate their records after successful writes. Batch
  // these signals so partial approval refreshes the shared feed only once.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const domains = new Set([
      "shifts",
      "clients",
      "workers",
      "worker",
      "worker-credentials",
      "authorizations",
      "placements",
      "weekly-care-need",
      "notifications",
      "invitations",
    ]);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "invalidate" &&
        domains.has(String(event.query.queryKey[0]))
      ) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void queryClient.invalidateQueries({
            queryKey: ["attention-items", userId],
          });
          void queryClient.invalidateQueries({ queryKey: ["activity"] });
        }, 50);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [queryClient, userId]);
  useEffect(() => {
    const check = () =>
      setObscured(
        [
          ...document.querySelectorAll(
            'dialog[open], [aria-modal="true"], .fixed.inset-0',
          ),
        ].some((el) => {
          const style = getComputedStyle(el);
          return (
            el.getClientRects().length > 0 &&
            style.visibility !== "hidden" &&
            (el.matches("dialog[open]") || Number(style.zIndex) >= 40)
          );
        }),
      );
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-modal"],
    });
    check();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open && !dashboard && !obscured) minimizer.current?.focus();
  }, [open, dashboard, obscured]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !obscured) {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, obscured]);
  const value: AttentionContextValue = {
    actionError: overtime.isError
      ? "Could not open the request. Try again."
      : undefined,
    items: query.data?.items ?? [],
    unreadCount: query.data?.unread_count ?? 0,
    onTarget: (target) =>
      value.onSelect({
        id: target.record_id,
        category: "schedule",
        stage: "review_schedule",
        urgency: "review",
        subject: "",
        detail: "",
        due_on: null,
        target,
      } as AttentionItem),
    loading: query.isPending,
    error: query.isError,
    selectedId,
    expanded,
    onExpanded: (id, show) =>
      setExpanded((current) =>
        show ? [...new Set([...current, id])] : current.filter((v) => v !== id),
      ),
    onRetry: () => {
      void query.refetch();
    },
    onSelect: (item) => {
      if (item.target.kind === "overtime") {
        overtime.mutate(item.target.record_id, {
          onSuccess: () => setOpen(false),
        });
        return;
      }
      const markViewed = () =>
        read.mutate(
          (item.notification_ids ?? []).map(
            (id) =>
              ({
                id: `notice:${id}`,
                unread: true,
              }) as import("../types").ActivityEntry,
          ),
        );
      const destination = attentionDestination(item);
      const href = router.buildLocation(destination).href;
      const attentionNavigationId = crypto.randomUUID();
      void navigate({ ...destination, state: { attentionNavigationId } }).then(
        () => {
          // A cancelled unsaved-changes prompt must leave the queue in place.
          if (
            router.state.location.href === href &&
            router.state.location.state.attentionNavigationId ===
              attentionNavigationId
          ) {
            if (item.notification_ids?.length) markViewed();
            setSelectedId(item.id);
            setOpen(false);
          }
        },
      );
    },
  };
  const count = value.items.filter(
    (i) => i.urgency !== "waiting" && i.action_required !== false,
  ).length;
  const visible = !dashboard && !obscured;
  return (
    <AttentionContext.Provider value={value}>
      {children}
      {createPortal(
        <>
          {visible && (
            <>
              {open && (
                <div
                  id="action-tower-panel"
                  role="dialog"
                  aria-label="Action Tower"
                  className="fixed bottom-[100px] right-6 z-30 flex max-h-[calc(100dvh-124px)] w-[430px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-ink bg-paper shadow-xl max-sm:right-4"
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink px-5 py-4">
                    <h2 className="font-mono text-xs uppercase tracking-widest">
                      Action Tower
                    </h2>
                    <button
                      ref={minimizer}
                      aria-label="Minimize Action Tower"
                      onClick={() => {
                        setOpen(false);
                        launcher.current?.focus();
                      }}
                      className="p-2 hover:bg-cream-2"
                    >
                      <Minus size={17} />
                    </button>
                  </div>
                  {overtime.isError && (
                    <p role="alert" className="px-5 py-3 text-sm">
                      Could not open the request. Try again.
                    </p>
                  )}
                  {selectedId && (
                    <button
                      onClick={() => void navigate({ to: "/dashboard" })}
                      className="border-b border-line-soft px-5 py-3 text-left font-mono text-xs underline"
                    >
                      ← Needs attention
                    </button>
                  )}
                  <div className="overflow-y-auto overscroll-contain">
                    <AttentionList {...value} />
                  </div>
                </div>
              )}
              <button
                ref={launcher}
                onClick={() => setOpen((v) => !v)}
                aria-label={`${open ? "Minimize" : "Open"} Action Tower${query.isError ? ", checks unavailable" : `, ${count} items need attention`}`}
                aria-expanded={open}
                aria-controls="action-tower-panel"
                aria-haspopup="dialog"
                className="fixed bottom-6 right-6 z-30 flex h-[58px] w-[58px] items-center justify-center rounded-full border border-ink bg-ink text-cream shadow-lg hover:bg-ink-soft max-sm:right-4"
              >
                {open ? <Minus size={24} /> : <ListChecks size={24} />}
                {!open && (query.data?.unread_count ?? 0) > 0 && (
                  <span
                    className="absolute -left-1 top-0 h-3 w-3 rounded-full border border-cream bg-mint"
                    aria-label="New updates"
                  />
                )}
                {!open && (query.isError || query.isPending || count > 0) && (
                  <span className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full border border-ink bg-orange px-1 font-mono text-[11px] text-ink">
                    {query.isError
                      ? "!"
                      : query.isPending
                        ? "…"
                        : count > 99
                          ? "99+"
                          : count}
                  </span>
                )}
              </button>
            </>
          )}
        </>,
        document.body,
      )}
    </AttentionContext.Provider>
  );
}
