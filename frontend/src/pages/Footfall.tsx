import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PageHeader, StatusPill } from "@/components/crm/ui";
import { useAuth } from "@/context/AuthContext";
import { formatDMY, istHour, istToday, slotLabel, slotRange } from "@/lib/ist";

export function Footfall() {
  const { displayName } = useAuth();
  const [date, setDate] = useState(istToday());
  const [drafts, setDrafts] = useState<Record<number, { visitors: string; remarks: string }>>({});
  const [bills, setBills] = useState("0");
  const [data, setData] = useState<{ entries: any[]; bills: number; openHour: number; closeHour: number; cutoff: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentHour = istHour();
  const isToday = date === istToday();

  async function loadData() {
    setIsLoading(true);
    try {
      const [entriesRes, summaryRes, settingsRes] = await Promise.all([
        api.get(`/crm/footfall?date=${date}`),
        api.get(`/crm/daily-summaries?date=${date}`),
        api.get('/crm/settings'),
      ]);
      setData({
        entries: entriesRes.data || [],
        bills: summaryRes.data?.bills_count || 0,
        openHour: settingsRes.data?.open_hour || 10,
        closeHour: settingsRes.data?.close_hour || 22,
        cutoff: settingsRes.data?.edit_cutoff_hours || 3,
      });
    } catch (err) {
      console.error("Failed to load footfall data", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  useEffect(() => {
    if (!data) return;
    const next: Record<number, { visitors: string; remarks: string }> = {};
    data.entries.forEach((row: any) => {
      next[row.slot_hour] = { visitors: String(row.visitors), remarks: row.remarks ?? "" };
    });
    setDrafts(next);
    setBills(String(data.bills));
  }, [data]);

  const slots = slotRange(data?.openHour ?? 10, data?.closeHour ?? 22);
  const cutoff = data?.cutoff ?? 3;

  function lockState(hour: number) {
    if (!isToday) return date > istToday() ? "future" : "open";
    if (hour > currentHour) return "future";
    if (currentHour - hour > cutoff) return "expired";
    return "open";
  }

  async function saveSlot(hour: number) {
    const draft = drafts[hour];
    const visitors = Number(draft?.visitors ?? 0);
    if (!Number.isFinite(visitors) || visitors < 0) {
      toast.error("Enter a valid visitor count");
      return;
    }
    try {
      await api.post("/crm/footfall/upsert", {
        entry_date: date,
        slot_hour: hour,
        visitors,
        remarks: draft?.remarks?.trim() || null,
      });
      toast.success(`${slotLabel(hour)} saved`);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save slot");
    }
  }

  async function saveBills() {
    const count = Number(bills);
    if (!Number.isFinite(count) || count < 0) {
      toast.error("Enter a valid bill count");
      return;
    }
    try {
      await api.post("/crm/daily-summaries/upsert", {
        entry_date: date,
        bills_count: count,
      });
      toast.success("Daily bills updated");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save daily bills");
    }
  }

  const total = Object.values(drafts).reduce((sum, d) => sum + (Number(d.visitors) || 0), 0);

  return (
    <>
      <PageHeader
        title="Footfall Entry"
        subtitle={`Hourly visitor log for ${formatDMY(date)} · edits allowed up to ${cutoff}h after the slot`}
        actions={
          <>
            <input
              type="date"
              value={date}
              max={istToday()}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm w-44"
            />
            <div className="panel px-4 py-2">
              <span className="eyebrow">Total</span>
              <span className="num ml-2 text-lg font-bold">{total}</span>
            </div>
          </>
        }
      />

      <div className="panel mb-6 flex flex-wrap items-end gap-4 p-5">
        <div className="space-y-1.5">
          <label htmlFor="bills" className="text-sm font-medium">Daily bills count</label>
          <input
            id="bills"
            inputMode="numeric"
            value={bills}
            onChange={(e) => setBills(e.target.value.replace(/\D/g, ""))}
            className="h-10 w-40 rounded-md border border-input bg-card px-3 text-sm"
          />
        </div>
        <button
          onClick={saveBills}
          className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <Save className="mr-2 h-4 w-4" /> Save bills
        </button>
        <p className="ml-auto text-sm text-muted-foreground">
          Conversion:{" "}
          <span className="num font-semibold text-foreground">
            {total ? Math.round((Number(bills) / total) * 100) : 0}%
          </span>
        </p>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary/60 text-left">
            <tr>
              <th className="px-5 py-3 font-semibold">Slot</th>
              <th className="px-3 py-3 font-semibold">Visitors</th>
              <th className="px-3 py-3 font-semibold">Remarks</th>
              <th className="px-3 py-3 font-semibold">Submitted by</th>
              <th className="px-5 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  Loading slots…
                </td>
              </tr>
            )}
            {!isLoading &&
              slots.map((hour) => {
                const state = lockState(hour);
                const saved = data?.entries.find((row) => row.slot_hour === hour);
                const locked = state !== "open";
                return (
                  <tr key={hour} className="border-t border-border/60">
                    <td className="px-5 py-2.5">
                      <span className="num text-xs">{slotLabel(hour)}</span>
                      {state === "future" && (
                        <StatusPill tone="neutral">
                          <Lock className="h-3 w-3" /> Locked
                        </StatusPill>
                      )}
                      {state === "expired" && !saved && (
                        <StatusPill tone="danger">Missed</StatusPill>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        disabled={locked}
                        value={drafts[hour]?.visitors ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [hour]: {
                              visitors: e.target.value.replace(/\D/g, ""),
                              remarks: prev[hour]?.remarks ?? "",
                            },
                          }))
                        }
                        className="num h-9 w-24 rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={locked}
                        maxLength={160}
                        value={drafts[hour]?.remarks ?? ""}
                        placeholder="Optional note"
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [hour]: {
                              visitors: prev[hour]?.visitors ?? "",
                              remarks: e.target.value,
                            },
                          }))
                        }
                        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {saved?.submitted_by_name ?? "—"}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        disabled={locked}
                        onClick={() => saveSlot(hour)}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {saved ? "Update" : "Submit"}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </>
  );
}
