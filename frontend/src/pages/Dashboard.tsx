import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "@/lib/api";
import { KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { hourLabel, istHour, slotLabel, slotRange } from "@/lib/ist";
import { scoreFeedback } from "@/lib/crm";

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentHour = istHour();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await api.get("/crm/dashboard");
        setData(res.data);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const slots = slotRange(data?.openHour ?? 10, data?.closeHour ?? 22);
  const byHour = new Map<number, any>((data?.footfall ?? []).map((row: any) => [row.slot_hour, row]));
  const totalFootfall = (data?.footfall ?? []).reduce((sum: number, row: any) => sum + row.visitors, 0);
  const peak = (data?.footfall ?? []).reduce(
    (best: any, row: any) => (row.visitors > best.visitors ? row : best),
    { slot_hour: -1, visitors: 0 },
  );
  const bills = data?.bills ?? 0;
  const conversion = totalFootfall ? Math.round((bills / totalFootfall) * 100) : 0;
  const { nps, csi } = scoreFeedback(data?.feedback ?? []);
  const voices = (data?.feedback ?? []).filter((row: any) => row.voice?.trim());

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
              {[...voices, ...voices].map((row: any, index: number) => (
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
