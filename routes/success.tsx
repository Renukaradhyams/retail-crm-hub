import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/success")({
  head: () => ({
    meta: [
      { title: "Thank You — BSC Retail" },
      {
        name: "description",
        content: "Your feedback has reached the BSC Retail store team. We read every response.",
      },
      { property: "og:title", content: "Thank You — BSC Retail" },
      { property: "og:description", content: "Your feedback has reached the BSC Retail store team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="panel max-w-md p-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold">Thank you</h1>
        <p className="mt-2 text-muted-foreground">
          Your feedback has reached our store team. If you raised a concern, a manager will call
          you back shortly.
        </p>
        <Link
          to="/feedback"
          className="mt-6 inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold"
        >
          Submit another response
        </Link>
      </div>
    </main>
  );
}
