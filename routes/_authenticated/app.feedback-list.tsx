import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CALL_STATUS_LABELS, type CallStatus } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";

export const Route = createFileRoute("/_authenticated/app/feedback-list")({
  component: CallQueuePage,
});

const TONE: Record<CallStatus, "info" | "warning" | "success" | "danger"> = {
  new: "info",
  called: "warning",
  resolved: "success",
  escalated: "danger",
};

function CallQueuePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<string>("");
  const [section, setSection] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["call-queue", date, status, section],
    queryFn: async () => {
      let query = supabase.from("call_queue").select("*").order("created_at", { ascending: false });
      if (date) query = query.eq("entry_date", date);
      if (status) query = query.eq("status", status as CallStatus);
      if (section) query = query.ilike("section_name", `%${section}%`);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const current = rows.find((row) => row.id === active) ?? null;

  async function update(
    id: string,
    patch: Partial<{
      status: CallStatus;
      notes: string | null;
      attempts: number;
      escalated: boolean;
      follow_up_date: string | null;
    }>,
  ) {
    const { error } = await supabase.from("call_queue").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["call-queue"] });
  }

  async function logCall(nextStatus: CallStatus) {
    if (!current) return;
    await update(current.id, {
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
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
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
            <Input
              placeholder="Filter section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-44"
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
                    <StatusPill tone={TONE[row.status]}>
                      {CALL_STATUS_LABELS[row.status]}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setActive(row.id);
                        setNotes(row.notes ?? "");
                        setFollowUp(row.follow_up_date ?? istToday());
                      }}
                    >
                      <Phone className="mr-2 h-3.5 w-3.5" /> Log call
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!current} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Call {current?.customer_name} · {current?.mobile}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes">Call notes</Label>
              <Textarea
                id="notes"
                rows={4}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did the customer say?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="follow">Follow-up date</Label>
              <Input
                id="follow"
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => logCall("called")} variant="secondary">
                Mark called
              </Button>
              <Button onClick={() => logCall("resolved")}>Resolve</Button>
              <Button onClick={() => logCall("escalated")} variant="destructive">
                <ArrowUpRight className="mr-2 h-4 w-4" /> Escalate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
