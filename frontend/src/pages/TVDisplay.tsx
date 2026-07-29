import { useState, useEffect } from "react";
import api from "@/lib/api";
import { formatDMY, istToday, slotLabel } from "@/lib/ist";
import { PinGate } from "@/components/crm/PinGate";

export function TVDisplay() {
  return (
    <PinGate kind="tv" fullscreen title="Store Live Board" description="Enter the TV display PIN to show the board.">
      <TvBoard />
    </PinGate>
  );
}

function TvBoard() {
  const today = istToday();
  const [data, setData] = useState<{ entries: any[]; summary: any } | null>(null);

  useEffect(() => {
    async function loadTvData() {
      try {
        const [entriesRes, summaryRes] = await Promise.all([
          api.get(`/crm/footfall?date=${today}`),
          api.get(`/crm/daily-summaries?date=${today}`),
        ]);
        setData({ entries: entriesRes.data || [], summary: summaryRes.data });
      } catch (err) {
        console.error("Failed to load TV board data", err);
      }
    }
    loadTvData();
    const interval = setInterval(loadTvData, 60000);
    return () => clearInterval(interval);
  }, [today]);

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
