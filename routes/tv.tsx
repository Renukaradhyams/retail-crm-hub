import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDMY, istToday, slotLabel } from "@/lib/ist";
import { PinGate } from "@/components/crm/PinGate";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Store Live Board — BSC Retail CRM" },
      { name: "description", content: "Fullscreen live board with footfall, conversion and customer feedback." },
      { property: "og:title", content: "Store Live Board — BSC Retail CRM" },
      { property: "og:description", content: "Fullscreen live board with footfall, conversion and customer feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  return (
    <PinGate kind="tv" fullscreen title="Store Live Board" description="Enter the TV display PIN to show the board.">
      <TvBoard />
    </PinGate>
  );
}

function TvBoard() {
  const today = istToday();
  const { data } = useQuery({
    queryKey: ["tv", today],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [entries, summary] = await Promise.all([
        supabase.from("footfall_entries").select("*").eq("entry_date", today).order("slot_hour"),
        supabase.from("daily_summaries").select("*").eq("entry_date", today).maybeSingle(),
      ]);
      return { entries: entries.data ?? [], summary: summary.data };
    },
  });

  const entries = data?.entries ?? [];
  const visitors = entries.reduce((sum, e) => sum + e.visitors, 0);
  const bills = data?.summary?.bills_count ?? 0;
  const conversion = visitors ? Math.round((bills / visitors) * 100) : 0;

  return (
    <main className="min-h-screen bg-sidebar px-10 py-8 text-sidebar-foreground">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl font-bold">Store Live Board</h1>
        <p className="num text-xl opacity-70">{formatDMY(today)}</p>
      </header>

      <section className="mt-8 grid gap-6 sm:grid-cols-3">
        {[
          ["Visitors today", visitors],
          ["Bills", bills],
          ["Conversion", `${conversion}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-sidebar-accent p-8">
            <p className="text-sm uppercase tracking-widest opacity-70">{label}</p>
            <p className="num mt-3 text-6xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-sidebar-border px-5 py-4">
            <p className="text-sm opacity-70">{slotLabel(entry.slot_hour)}</p>
            <p className="num text-3xl font-semibold">{entry.visitors}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
