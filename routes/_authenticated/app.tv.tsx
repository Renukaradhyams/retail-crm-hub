import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/tv")({
  beforeLoad: () => {
    throw redirect({ to: "/tv" });
  },
});
