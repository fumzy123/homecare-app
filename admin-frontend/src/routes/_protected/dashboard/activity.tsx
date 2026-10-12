import { createFileRoute } from "@tanstack/react-router";
import { ActivityPage } from "@/features/attention/components/ActivityPage";
export const Route = createFileRoute("/_protected/dashboard/activity")({
  component: ActivityPage,
});
