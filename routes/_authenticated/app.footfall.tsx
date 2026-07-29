import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { formatDMY, istHour, istToday, slotLabel, slotRange } from "@/lib/ist";

export const Route = createFileRoute("/_authenticated/app/footfall")({
  component: FootfallPage,
});

function FootfallPage() {
  const queryClient = useQueryClient();
  const { user, displayName } = useMe();
  const [date, setDate] = useState(istToday());
  const [drafts, setDrafts] = useState<Record<number, { visitors: string; remarks: string }>>({});
  const [bills, setBills] = useState("0");
  const currentHour = istHour();
  const isToday = date === istToday();

  const { data, isLoading } = useQuery({
    queryKey: ["footfall", date],
    queryFn: async () => {
      const [entries, summary, settings] = await Promise.all([
        supabase.from("footfall_entries").select("*").eq("entry_date", date).order("slot_hour"),
        supabase.from("daily_summaries").select("*").eq("entry_date", date).maybeSingle(),
        supabase.from("settings").select("open_hour, close_hour, edit_cutoff_hours").maybeSingle(),
      ]);
      return {
        entries: entries.data ?? [],
        bills: summary.data?.bills_count ?? 0,
        openHour: settings.data?.open_hour ?? 10,
        closeHour: settings.data?.close_hour ?? 22,
        cutoff: settings.data?.edit_cutoff_hours ?? 3,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    const next: Record<number, { visitors: string; remarks: string }> = {};
    data.entries.forEach((row) => {
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
    const { error } = await supabase.from("footfall_entries").upsert(
      {
        entry_date: date,
        slot_hour: hour,
        visitors,
        remarks: draft?.remarks?.trim() || null,
        submitted_by: user?.id ?? null,
        submitted_by_name: displayName,
      },
      { onConflict: "entry_date,slot_hour" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${slotLabel(hour)} saved`);
    queryClient.invalidateQueries({ queryKey: ["footfall", date] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function saveBills() {
    const count = Number(bills);
    if (!Number.isFinite(count) || count < 0) {
      toast.error("Enter a valid bill count");
      return;
    }
    const { error } = await supabase
      .from("daily_summaries")
      .upsert({ entry_date: date, bills_count: count }, { onConflict: "entry_date" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Daily bills updated");
    queryClient.invalidateQueries({ queryKey: ["footfall", date] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const total = Object.values(drafts).reduce((sum, d) => sum + (Number(d.visitors) || 0), 0);

  return (
    <>
      <PageHeader
        title="Footfall Entry"
        subtitle={`Hourly visitor log for ${formatDMY(date)} · edits allowed up to ${cutoff}h after the slot`}
        actions={
          <>
            <Input
              type="date"
              value={date}
              max={istToday()}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
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
          <Label htmlFor="bills">Daily bills count</Label>
          <Input
            id="bills"
            inputMode="numeric"
            value={bills}
            onChange={(e) => setBills(e.target.value.replace(/\D/g, ""))}
            className="w-40"
          />
        </div>
        <Button onClick={saveBills} variant="secondary">
          <Save className="mr-2 h-4 w-4" /> Save bills
        </Button>
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
                      <Input
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
                        className="num w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
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
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {saved?.submitted_by_name ?? "—"}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <Button size="sm" disabled={locked} onClick={() => saveSlot(hour)}>
                        {saved ? "Update" : "Submit"}
                      </Button>
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
