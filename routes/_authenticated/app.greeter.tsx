import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/greeter")({
  beforeLoad: () => {
    throw redirect({ to: "/greeter" });
  },
});
