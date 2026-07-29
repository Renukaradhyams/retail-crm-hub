import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { EmptyState, KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { useAuth } from "@/context/AuthContext";
import { VM_SHIFT_LABELS, type VmScore, type VmShift } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";
import { cn } from "@/lib/utils";

const SCORES: { value: VmScore; label: string }[] = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "na", label: "NA" },
];

export function VmChecklist() {
  const { displayName } = useAuth();
  const [tab, setTab] = useState<"form" | "history">("form");
  const [shift, setShift] = useState<VmShift>("opening");
  const [floor, setFloor] = useState("Ground Floor");
  const [entries, setEntries] = useState<Record<string, { score: VmScore; remarks: string; photo: string }>>({});
  const [points, setPoints] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setIsLoading(true);
    try {
      const [pointsRes, subsRes] = await Promise.all([
        api.get("/vm/points"),
        api.get("/vm/submissions"),
      ]);
      setPoints(pointsRes.data || []);
      setSubmissions(subsRes.data || []);
    } catch (err) {
      console.error("Failed to load VM data", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const scored = points.filter((p) => entries[p.id] && entries[p.id].score !== "na");
  const passed = scored.filter((p) => entries[p.id].score === "pass").length;
  const percent = scored.length ? Math.round((passed / scored.length) * 100) : 0;
  const avgScore = submissions.length
    ? Math.round(
        submissions.reduce((sum, s) => sum + Number(s.score_percent), 0) / submissions.length,
      )
    : 0;

  async function submit() {
    if (!scored.length) {
      toast.error("Score at least one checklist point");
      return;
    }
    try {
      await api.post("/vm/submit", {
        entry_date: istToday(),
        shift,
        floor,
        score_percent: percent,
        entries: points.map((point) => ({
          point_id: point.id,
          point_title: point.title,
          score: entries[point.id]?.score ?? "na",
          remarks: entries[point.id]?.remarks || null,
          photo_url: entries[point.id]?.photo || null,
        })),
      });
      toast.success(`Submitted · ${percent}%`);
      setEntries({});
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to submit checklist");
    }
  }

  return (
    <>
      <PageHeader
        title="VM Checklist"
        subtitle="Visual merchandising audit by shift and floor."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setTab("form")}
              className={`h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === "form" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              Checklist
            </button>
            <button
              onClick={() => setTab("history")}
              className={`h-9 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === "history" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              History
            </button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Current score" value={`${percent}%`} tone="success" hint={`${scored.length} points scored`} />
        <KpiCard label="Recent average" value={`${avgScore}%`} tone="accent" />
        <KpiCard label="Submissions" value={submissions.length} />
      </div>

      {tab === "form" ? (
        <div className="mt-6 space-y-4">
          <div className="panel flex flex-wrap gap-4 p-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Shift</label>
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
              <label className="text-sm font-medium">Floor</label>
              <input value={floor} onChange={(e) => setFloor(e.target.value)} className="h-10 w-52 rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <button onClick={submit} className="ml-auto self-end h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              Submit checklist
            </button>
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
                <input
                  placeholder="Remarks"
                  className="h-9 max-w-xs rounded-md border border-input bg-card px-3 text-sm"
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
                <input
                  placeholder="Photo link"
                  className="h-9 max-w-xs rounded-md border border-input bg-card px-3 text-sm"
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
      ) : submissions.length === 0 ? (
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
              {submissions.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="num px-5 py-3 text-xs">{formatDMY(row.entry_date)}</td>
                  <td className="px-3 py-3">{VM_SHIFT_LABELS[row.shift as VmShift]}</td>
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
