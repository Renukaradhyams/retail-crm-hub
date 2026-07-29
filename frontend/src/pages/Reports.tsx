import { useRef, useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { KpiCard, PageHeader } from "@/components/crm/ui";
import { addDays, formatDMY, istToday } from "@/lib/ist";
import { scoreFeedback } from "@/lib/crm";
import { downloadCsv, parseCsvRecords } from "@/lib/csv";

export function Reports() {
  const [from, setFrom] = useState(addDays(istToday(), -13));
  const [to, setTo] = useState(istToday());
  const [importing, setImporting] = useState(false);
  const [data, setData] = useState<{ footfall: any[]; bills: any[]; feedback: any[]; diverts: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await api.get(`/crm/reports?from=${from}&to=${to}`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load reports", err);
      }
    }
    fetchReports();
  }, [from, to]);

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
        await api.post("/crm/footfall/import", { rows: footfall });
      }
      if (bills.size) {
        for (const [entry_date, bills_count] of bills) {
          await api.post("/crm/daily-summaries/upsert", { entry_date, bills_count });
        }
      }

      toast.success(`Imported ${footfall.length} footfall rows and ${bills.size} bill totals`);
      const res = await api.get(`/crm/reports?from=${from}&to=${to}`);
      setData(res.data);
    } catch (error: any) {
      toast.error(error.message || "Import failed");
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
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm w-40" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm w-40" />
            <button
              onClick={exportSummary}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Download className="mr-2 h-4 w-4" /> Summary CSV
            </button>
            <button
              onClick={exportDetailed}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <FileDown className="mr-2 h-4 w-4" /> Hourly CSV
            </button>
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
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              aria-label="Import CSV"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Upload className="mr-2 h-4 w-4" /> {importing ? "Importing…" : "Import CSV"}
            </button>
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
