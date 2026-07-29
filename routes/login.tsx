import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && search.next.startsWith("/")
      ? { next: search.next }
      : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/auth", search: search.next ? { next: search.next } : {} });
  },
});
