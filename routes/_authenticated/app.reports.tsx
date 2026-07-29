import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard, PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, formatDMY, istToday } from "@/lib/ist";
import { scoreFeedback } from "@/lib/crm";
import { downloadCsv, parseCsvRecords } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports & Analytics · BSC Retail CRM" },
      {
        name: "description",
        content:
          "Footfall, conversion, feedback and divert analytics for BSC Retail, with CSV export and import.",
      },
      { property: "og:title", content: "Reports & Analytics · BSC Retail CRM" },
      {
        property: "og:description",
        content: "Store performance trends with CSV export and import.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ReportsPage() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(addDays(istToday(), -13));
  const [to, setTo] = useState(istToday());
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const [footfall, bills, feedback, diverts] = await Promise.all([
        supabase
          .from("footfall_entries")
          .select("entry_date, slot_hour, visitors")
          .gte("entry_date", from)
          .lte("entry_date", to),
        supabase
          .from("daily_summaries")
          .select("entry_date, bills_count")
          .gte("entry_date", from)
          .lte("entry_date", to),
        supabase.from("feedback").select("answers").gte("entry_date", from).lte("entry_date", to),
        supabase.from("diverts").select("status").gte("entry_date", from).lte("entry_date", to),
      ]);
      return {
        footfall: footfall.data ?? [],
        bills: bills.data ?? [],
        feedback: feedback.data ?? [],
        diverts: diverts.data ?? [],
      };
    },
  });

  const byDate = new Map<string, { date: string; visitors: number; bills: number }>();
  (data?.footfall ?? []).forEach((row) => {
    const entry = byDate.get(row.entry_date) ?? { date: row.entry_date, visitors: 0, bills: 0 };
    entry.visitors += row.visitors;
    byDate.set(row.entry_date, entry);
  });
  (data?.bills ?? []).forEach((row) => {
    const entry = byDate.get(row.entry_date) ?? { date: row.entry_date, visitors: 0, bills: 0 };
    entry.bills = row.bills_count;
    byDate.set(row.entry_date, entry);
  });
  const series = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ ...row, label: formatDMY(row.date).slice(0, 5) }));

  const totalVisitors = series.reduce((sum, row) => sum + row.visitors, 0);
  const totalBills = series.reduce((sum, row) => sum + row.bills, 0);
  const { nps, csi } = scoreFeedback(data?.feedback ?? []);
  const divertRows = data?.diverts ?? [];
  const resolved = divertRows.filter((d) => d.status === "closed" || d.status === "available").length;
  const resolutionRate = divertRows.length ? Math.round((resolved / divertRows.length) * 100) : 0;

  /** Daily summary export (date-level totals). */
  function exportSummary() {
    if (!series.length) {
      toast.error("Nothing to export for this range");
      return;
    }
    downloadCsv(`bsc-summary-${from}-to-${to}.csv`, [
      ["Date", "Visitors", "Bills", "Conversion %"],
      ...series.map((row) => [
        row.date,
        row.visitors,
        row.bills,
        row.visitors ? Math.round((row.bills / row.visitors) * 100) : 0,
      ]),
    ]);
  }

  /** Hour-level export — same shape the importer accepts, so it round-trips. */
  function exportDetailed() {
    const rows = data?.footfall ?? [];
    if (!rows.length) {
      toast.error("No footfall rows in this range");
      return;
    }
    const billsByDate = new Map((data?.bills ?? []).map((b) => [b.entry_date, b.bills_count]));
    downloadCsv(`bsc-footfall-${from}-to-${to}.csv`, [
      ["date", "slot_hour", "visitors", "bills"],
      ...[...rows]
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.slot_hour - b.slot_hour)
        .map((row) => [
          row.entry_date,
          row.slot_hour,
          row.visitors,
          billsByDate.get(row.entry_date) ?? "",
        ]),
    ]);
  }

  /** Import CSV with columns: date, slot_hour, visitors, bills (bills optional). */
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const records = parseCsvRecords(await file.text());
      if (!records.length) throw new Error("The file has no data rows");

      const footfall: { entry_date: string; slot_hour: number; visitors: number }[] = [];
      const bills = new Map<string, number>();

      records.forEach((record, index) => {
        const date = record.date || record.entry_date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
          throw new Error(`Row ${index + 2}: date must be YYYY-MM-DD`);
        }
        const hourRaw = record.slot_hour ?? record.hour ?? "";
        const visitorsRaw = record.visitors ?? "";
        if (hourRaw !== "" && visitorsRaw !== "") {
          const slot_hour = Number(hourRaw);
          const visitors = Number(visitorsRaw);
          if (!Number.isInteger(slot_hour) || slot_hour < 0 || slot_hour > 23) {
            throw new Error(`Row ${index + 2}: slot_hour must be 0–23`);
          }
          if (!Number.isFinite(visitors) || visitors < 0) {
            throw new Error(`Row ${index + 2}: visitors must be a positive number`);
          }
          footfall.push({ entry_date: date, slot_hour, visitors: Math.round(visitors) });
        }
        const billsRaw = record.bills ?? record.bills_count ?? "";
        if (billsRaw !== "") {
          const count = Number(billsRaw);
          if (!Number.isFinite(count) || count < 0) {
            throw new Error(`Row ${index + 2}: bills must be a positive number`);
          }
          bills.set(date, Math.round(count));
        }
      });

      if (footfall.length) {
        const { error } = await supabase
          .from("footfall_entries")
          .upsert(footfall, { onConflict: "entry_date,slot_hour" });
        if (error) throw error;
      }
      if (bills.size) {
        const { error } = await supabase.from("daily_summaries").upsert(
          [...bills].map(([entry_date, bills_count]) => ({ entry_date, bills_count })),
          { onConflict: "entry_date" },
        );
        if (error) throw error;
      }

      toast.success(`Imported ${footfall.length} footfall rows and ${bills.size} bill totals`);
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["footfall"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Trends across footfall, conversion, feedback and divert resolution."
        actions={
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            <Button variant="secondary" onClick={exportSummary}>
              <Download className="mr-2 h-4 w-4" /> Summary CSV
            </Button>
            <Button variant="secondary" onClick={exportDetailed}>
              <FileDown className="mr-2 h-4 w-4" /> Hourly CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsv(file);
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              aria-label="Import CSV"
            >
              <Upload className="mr-2 h-4 w-4" /> {importing ? "Importing…" : "Import CSV"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Visitors" value={totalVisitors} />
        <KpiCard label="Bills" value={totalBills} tone="accent" />
        <KpiCard
          label="Conversion"
          value={`${totalVisitors ? Math.round((totalBills / totalVisitors) * 100) : 0}%`}
          tone="success"
        />
        <KpiCard label="NPS" value={`${nps}%`} tone="success" />
        <KpiCard label="Divert resolution" value={`${resolutionRate}%`} tone="warning" hint={`CSI ${csi}%`} />
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-base font-semibold">Footfall vs bills</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="visitors" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bills" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        Import format: a CSV with the headers <span className="num">date, slot_hour, visitors, bills</span>{" "}
        (dates as YYYY-MM-DD). Existing hours and daily bill totals are overwritten. Export the hourly CSV
        first for a ready-made template.
      </p>
    </>
  );
}
