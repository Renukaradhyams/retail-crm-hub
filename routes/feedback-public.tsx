import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback-public")({
  beforeLoad: () => {
    throw redirect({ to: "/feedback" });
  },
});
