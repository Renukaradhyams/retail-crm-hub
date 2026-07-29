import { useState, useEffect } from "react";
import { Phone, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { CALL_STATUS_LABELS, type CallStatus } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";

const TONE: Record<CallStatus, "info" | "warning" | "success" | "danger"> = {
  new: "info",
  called: "warning",
  resolved: "success",
  escalated: "danger",
};

export function FeedbackList() {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<string>("");
  const [section, setSection] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadCallQueue() {
    setIsLoading(true);
    try {
      let url = "/crm/call-queue?";
      if (date) url += `date=${date}&`;
      if (status) url += `status=${status}&`;
      if (section) url += `section=${encodeURIComponent(section)}&`;
      const res = await api.get(url);
      setRows(res.data || []);
    } catch (err) {
      console.error("Failed to load call queue", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCallQueue();
  }, [date, status, section]);

  const current = rows.find((row) => row.id === active) ?? null;

  async function updateCall(
    id: string,
    patch: Partial<{
      status: CallStatus;
      notes: string | null;
      attempts: number;
      escalated: boolean;
      follow_up_date: string | null;
    }>,
  ) {
    try {
      await api.patch(`/crm/call-queue/${id}`, patch);
      loadCallQueue();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update call record");
    }
  }

  async function logCall(nextStatus: CallStatus) {
    if (!current) return;
    await updateCall(current.id, {
      status: nextStatus,
      notes: notes.trim() || current.notes,
      attempts: current.attempts + 1,
      escalated: nextStatus === "escalated",
      follow_up_date: followUp || current.follow_up_date,
    });
    toast.success(`Marked as ${CALL_STATUS_LABELS[nextStatus]}`);
    setActive(null);
    setNotes("");
    setFollowUp("");
  }

  return (
    <>
      <PageHeader
        title="Call Queue"
        subtitle="Negative-feedback call-backs, newest first."
        actions={
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm w-44" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(CALL_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <input
              placeholder="Filter section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm w-44"
            />
          </>
        }
      />

      {isLoading ? (
        <EmptyState title="Loading call queue…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No call-backs pending"
          hint="Negative QR feedback lands here automatically."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Mobile</th>
                <th className="px-3 py-3 font-semibold">Section</th>
                <th className="px-3 py-3 font-semibold">Attempts</th>
                <th className="px-3 py-3 font-semibold">Follow-up</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="num px-5 py-3 text-xs">{formatDMY(row.entry_date)}</td>
                  <td className="px-3 py-3 font-medium">{row.customer_name}</td>
                  <td className="num px-3 py-3">{row.mobile}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.section_name ?? "—"}</td>
                  <td className="num px-3 py-3">{row.attempts}</td>
                  <td className="num px-3 py-3 text-xs">
                    {row.follow_up_date ? formatDMY(row.follow_up_date) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill tone={TONE[row.status as CallStatus]}>
                      {CALL_STATUS_LABELS[row.status as CallStatus]}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => {
                        setActive(row.id);
                        setNotes(row.notes ?? "");
                        setFollowUp(row.follow_up_date ?? istToday());
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      <Phone className="mr-2 h-3.5 w-3.5" /> Log call
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-lg p-6 space-y-4">
            <h2 className="font-display text-xl font-bold">
              Call {current.customer_name} · {current.mobile}
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium">Call notes</label>
              <textarea
                id="notes"
                rows={4}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did the customer say?"
                className="w-full rounded-md border border-input bg-card p-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="follow" className="text-sm font-medium">Follow-up date</label>
              <input
                id="follow"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => logCall("called")} className="h-9 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                Mark called
              </button>
              <button onClick={() => logCall("resolved")} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                Resolve
              </button>
              <button onClick={() => logCall("escalated")} className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium flex items-center">
                <ArrowUpRight className="mr-2 h-4 w-4" /> Escalate
              </button>
              <button onClick={() => setActive(null)} className="h-9 px-4 rounded-md border border-input bg-card text-sm font-medium ml-auto">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
