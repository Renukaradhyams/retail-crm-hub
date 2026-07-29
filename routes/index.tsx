import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, Footprints, PackageSearch, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BSC Retail CRM — Store Operations Platform" },
      {
        name: "description",
        content:
          "Track hourly footfall, customer feedback, sourcing diverts, cash settlement and VM checklists across your retail floor.",
      },
      { property: "og:title", content: "BSC Retail CRM — Store Operations Platform" },
      {
        property: "og:description",
        content:
          "One dashboard for footfall, feedback, diverts, cash settlement and visual merchandising.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Footprints, title: "Hourly footfall", text: "Slot-locked entry from 10 AM to 10 PM with audit trail." },
  { icon: QrCode, title: "QR feedback", text: "Customers scan, answer, and negative replies queue a call-back." },
  { icon: PackageSearch, title: "Sourcing diverts", text: "Capture lost demand and route it to purchase managers." },
  { icon: Wallet, title: "Cash settlement", text: "Counter-wise reconciliation with ABV and mode differences." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              BSC
            </div>
            <span className="font-display text-base font-semibold">BSC Retail CRM</span>
          </div>
          <Link
            to="/auth"
            className="rounded-lg bg-sidebar-primary px-4 py-2 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">Retail floor intelligence</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-extrabold leading-[1.05] text-foreground">
          Every visitor, every voice, every rupee — accounted for by the hour.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          BSC Retail CRM keeps the store floor honest: footfall logged slot by slot, feedback
          collected at the exit, lost sales converted into sourcing diverts, and cash reconciled
          counter by counter.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open the CRM <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Customer feedback form
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="panel p-5">
              <feature.icon className="h-5 w-5 text-accent" />
              <h2 className="mt-3 font-display text-base font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
