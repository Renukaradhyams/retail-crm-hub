import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { DIVERT_STATUS_LABELS, type DivertStatus } from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import { formatDMY } from "@/lib/ist";
import { STATUS_TONE } from "./Divert";

export function PMView() {
  const { displayName } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPendingDiverts() {
    setIsLoading(true);
    try {
      const res = await api.get("/crm/diverts?status=open,sourcing,available");
      setRows(res.data || []);
    } catch (err) {
      console.error("Failed to load PM diverts", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPendingDiverts();
  }, []);

  async function resolve(id: string, status: DivertStatus, note: string) {
    try {
      await api.patch(`/crm/diverts/${id}`, {
        status,
        pm_notes: note,
        note: note || `Purchase set status to ${DIVERT_STATUS_LABELS[status]}`,
      });
      toast.success("Divert updated");
      loadPendingDiverts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update divert");
    }
  }

  return (
    <>
      <PageHeader
        title="Purchase Manager View"
        subtitle="Diverts awaiting sourcing decisions."
      />
      {isLoading ? (
        <EmptyState title="Loading…" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing pending" hint="All diverts are closed or cancelled." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="panel space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="num text-xs text-muted-foreground">
                    #{row.ref_no} · {formatDMY(row.entry_date)}
                  </p>
                  <h2 className="font-display text-base font-semibold">{row.product_wanted}</h2>
                  <p className="text-sm text-muted-foreground">
                    {row.section_name ?? "—"} · Qty {row.quantity} · {row.price_range ?? "any price"}
                  </p>
                </div>
                <StatusPill tone={STATUS_TONE[row.status as DivertStatus]}>
                  {DIVERT_STATUS_LABELS[row.status as DivertStatus]}
                </StatusPill>
              </div>
              <p className="text-sm">
                {row.customer_name} · <span className="num">{row.customer_mobile}</span>
              </p>
              <textarea
                rows={2}
                defaultValue={row.pm_notes ?? ""}
                placeholder="Sourcing notes"
                id={`note-${row.id}`}
                maxLength={500}
                className="w-full rounded-md border border-input bg-card p-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {(["sourcing", "available", "closed", "cancelled"] as DivertStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      const el = document.getElementById(`note-${row.id}`) as HTMLTextAreaElement | null;
                      resolve(row.id, status, el?.value ?? "");
                    }}
                    className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                      status === "available"
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {DIVERT_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
