import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { hourLabel, istHour, istToday, slotLabel, slotRange } from "@/lib/ist";
import { scoreFeedback } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const today = istToday();
      const [footfall, bills, diverts, feedback, settings] = await Promise.all([
        supabase.from("footfall_entries").select("*").eq("entry_date", today).order("slot_hour"),
        supabase.from("daily_summaries").select("*").eq("entry_date", today).maybeSingle(),
        supabase
          .from("diverts")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "sourcing"]),
        supabase
          .from("feedback")
          .select("customer_name, voice, answers, created_at")
          .eq("entry_date", today)
          .order("created_at", { ascending: false }),
        supabase.from("settings").select("open_hour, close_hour").maybeSingle(),
      ]);
      return {
        footfall: footfall.data ?? [],
        bills: bills.data?.bills_count ?? 0,
        openDiverts: diverts.count ?? 0,
        feedback: feedback.data ?? [],
        openHour: settings.data?.open_hour ?? 10,
        closeHour: settings.data?.close_hour ?? 22,
      };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useDashboard();
  const currentHour = istHour();

  const slots = slotRange(data?.openHour ?? 10, data?.closeHour ?? 22);
  const byHour = new Map((data?.footfall ?? []).map((row) => [row.slot_hour, row]));
  const totalFootfall = (data?.footfall ?? []).reduce((sum, row) => sum + row.visitors, 0);
  const peak = (data?.footfall ?? []).reduce(
    (best, row) => (row.visitors > best.visitors ? row : best),
    { slot_hour: -1, visitors: 0 } as { slot_hour: number; visitors: number },
  );
  const bills = data?.bills ?? 0;
  const conversion = totalFootfall ? Math.round((bills / totalFootfall) * 100) : 0;
  const { nps, csi } = scoreFeedback(data?.feedback ?? []);
  const voices = (data?.feedback ?? []).filter((row) => row.voice?.trim());

  const chartData = slots.map((hour) => ({
    label: hourLabel(hour),
    visitors: byHour.get(hour)?.visitors ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Store Dashboard"
        subtitle={isLoading ? "Loading live metrics…" : "Live metrics · auto-refreshes every 30 seconds"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Today Footfall" value={totalFootfall} hint="Visitors logged" />
        <KpiCard label="Total Bills" value={bills} tone="accent" hint="Daily bill count" />
        <KpiCard
          label="Open Diverts"
          value={data?.openDiverts ?? 0}
          tone="warning"
          hint="Awaiting sourcing"
        />
        <KpiCard label="NPS" value={`${nps}%`} tone="success" hint="Recommend score" />
        <KpiCard label="CSI" value={`${csi}%`} tone="success" hint="Positive answers" />
      </div>

      <div className="mt-4 grid gap-4 rounded-xl bg-sidebar px-6 py-5 text-sidebar-foreground sm:grid-cols-4">
        <Ribbon label="Total Logged" value={`${totalFootfall}`} />
        <Ribbon label="Peak Hour" value={peak.slot_hour >= 0 ? hourLabel(peak.slot_hour) : "—"} />
        <Ribbon label="Peak Count" value={`${peak.visitors}`} />
        <Ribbon label="Conversion" value={`${conversion}%`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="panel p-5 xl:col-span-3">
          <h2 className="font-display text-base font-semibold">Hourly footfall distribution</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  fill="url(#ff)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel overflow-hidden xl:col-span-2">
          <h2 className="border-b border-border px-5 py-4 font-display text-base font-semibold">
            Hourly audit
          </h2>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {slots.map((hour) => {
                  const row = byHour.get(hour);
                  const isCurrent = hour === currentHour;
                  const status = row
                    ? "Submitted"
                    : isCurrent
                      ? "Active"
                      : hour < currentHour
                        ? "Missed"
                        : "Pending";
                  const tone =
                    status === "Submitted"
                      ? "success"
                      : status === "Active"
                        ? "info"
                        : status === "Missed"
                          ? "danger"
                          : "neutral";
                  return (
                    <tr key={hour} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2">
                          {isCurrent && (
                            <span className="live-dot h-2 w-2 rounded-full bg-success" />
                          )}
                          <span className="num text-xs">{slotLabel(hour)}</span>
                        </span>
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold">
                        {row?.visitors ?? "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <StatusPill tone={tone as never}>{status}</StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl bg-sidebar py-3 text-sidebar-foreground">
        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
          Voice of customer · today
        </p>
        {voices.length ? (
          <div className="overflow-hidden">
            <div className="marquee-track whitespace-nowrap">
              {[...voices, ...voices].map((row, index) => (
                <span key={index} className="px-8 text-sm text-sidebar-foreground/85">
                  “{row.voice}” — {row.customer_name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-6 text-sm text-sidebar-foreground/50">
            No customer voices captured yet today.
          </p>
        )}
      </section>
    </>
  );
}

function Ribbon({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
        {label}
      </p>
      <p className="num mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
