import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { VM_SHIFT_LABELS, type VmScore, type VmShift } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/vm-checklist")({
  component: VmPage,
});

const SCORES: { value: VmScore; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "NA" },
];

function VmPage() {
  const queryClient = useQueryClient();
  const { user, displayName } = useMe();
  const [tab, setTab] = useState<"form" | "history">("form");
  const [shift, setShift] = useState<VmShift>("opening");
  const [floor, setFloor] = useState("Ground Floor");
  const [entries, setEntries] = useState<Record<string, { score: VmScore; remarks: string; photo: string }>>({});

  const { data } = useQuery({
    queryKey: ["vm"],
    queryFn: async () => {
      const [points, submissions] = await Promise.all([
        supabase.from("vm_checklist_points").select("*").eq("is_active", true).order("position"),
        supabase.from("vm_submissions").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      return { points: points.data ?? [], submissions: submissions.data ?? [] };
    },
  });

  const points = data?.points ?? [];
  const scored = points.filter((p) => entries[p.id] && entries[p.id].score !== "na");
  const passed = scored.filter((p) => entries[p.id].score === "pass").length;
  const percent = scored.length ? Math.round((passed / scored.length) * 100) : 0;
  const avgScore = data?.submissions.length
    ? Math.round(
        data.submissions.reduce((sum, s) => sum + Number(s.score_percent), 0) / data.submissions.length,
      )
    : 0;

  async function submit() {
    if (!scored.length) {
      toast.error("Score at least one checklist point");
      return;
    }
    const { data: submission, error } = await supabase
      .from("vm_submissions")
      .insert({
        entry_date: istToday(),
        shift,
        floor,
        score_percent: percent,
        submitted_by: user?.id ?? null,
        submitted_by_name: displayName,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("vm_submission_entries").insert(
      points.map((point) => ({
        submission_id: submission.id,
        point_id: point.id,
        point_title: point.title,
        score: entries[point.id]?.score ?? "na",
        remarks: entries[point.id]?.remarks || null,
        photo_url: entries[point.id]?.photo || null,
      })),
    );
    toast.success(`Submitted · ${percent}%`);
    setEntries({});
    queryClient.invalidateQueries({ queryKey: ["vm"] });
  }

  return (
    <>
      <PageHeader
        title="VM Checklist"
        subtitle="Visual merchandising audit by shift and floor."
        actions={
          <div className="flex gap-2">
            <Button variant={tab === "form" ? "default" : "secondary"} onClick={() => setTab("form")}>
              Checklist
            </Button>
            <Button variant={tab === "history" ? "default" : "secondary"} onClick={() => setTab("history")}>
              History
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Current score" value={`${percent}%`} tone="success" hint={`${scored.length} points scored`} />
        <KpiCard label="Recent average" value={`${avgScore}%`} tone="accent" />
        <KpiCard label="Submissions" value={data?.submissions.length ?? 0} />
      </div>

      {tab === "form" ? (
        <div className="mt-6 space-y-4">
          <div className="panel flex flex-wrap gap-4 p-5">
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as VmShift)}
                className="h-10 rounded-md border border-input bg-card px-3 text-sm"
              >
                {Object.entries(VM_SHIFT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Floor</Label>
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} className="w-52" />
            </div>
            <Button className="ml-auto self-end" onClick={submit}>
              Submit checklist
            </Button>
          </div>

          {points.map((point) => (
            <div key={point.id} className="panel p-5">
              <p className="font-medium">{point.title}</p>
              {point.description && (
                <p className="text-sm text-muted-foreground">{point.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {SCORES.map((option) => {
                  const active = entries[point.id]?.score === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() =>
                        setEntries((prev) => ({
                          ...prev,
                          [point.id]: {
                            score: option.value,
                            remarks: prev[point.id]?.remarks ?? "",
                            photo: prev[point.id]?.photo ?? "",
                          },
                        }))
                      }
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm transition-colors",
                        active
                          ? option.value === "fail"
                            ? "border-destructive bg-destructive text-destructive-foreground"
                            : "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <Input
                  placeholder="Remarks"
                  className="max-w-xs"
                  value={entries[point.id]?.remarks ?? ""}
                  onChange={(e) =>
                    setEntries((prev) => ({
                      ...prev,
                      [point.id]: {
                        score: prev[point.id]?.score ?? "na",
                        remarks: e.target.value,
                        photo: prev[point.id]?.photo ?? "",
                      },
                    }))
                  }
                />
                <Input
                  placeholder="Photo link"
                  className="max-w-xs"
                  value={entries[point.id]?.photo ?? ""}
                  onChange={(e) =>
                    setEntries((prev) => ({
                      ...prev,
                      [point.id]: {
                        score: prev[point.id]?.score ?? "na",
                        remarks: prev[point.id]?.remarks ?? "",
                        photo: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (data?.submissions.length ?? 0) === 0 ? (
        <div className="mt-6">
          <EmptyState title="No submissions yet" />
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Shift</th>
                <th className="px-3 py-3 font-semibold">Floor</th>
                <th className="px-3 py-3 font-semibold">By</th>
                <th className="px-5 py-3 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {(data?.submissions ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="num px-5 py-3 text-xs">{formatDMY(row.entry_date)}</td>
                  <td className="px-3 py-3">{VM_SHIFT_LABELS[row.shift]}</td>
                  <td className="px-3 py-3">{row.floor}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.submitted_by_name ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <StatusPill tone={Number(row.score_percent) >= 80 ? "success" : "warning"}>
                      {Number(row.score_percent)}%
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
