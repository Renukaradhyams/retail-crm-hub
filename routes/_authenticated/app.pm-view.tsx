import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DIVERT_STATUS_LABELS, type DivertStatus } from "@/lib/crm";
import { useMe } from "@/hooks/useMe";
import { formatDMY } from "@/lib/ist";
import { STATUS_TONE } from "./app.divert";

export const Route = createFileRoute("/_authenticated/app/pm-view")({
  component: PmView,
});

function PmView() {
  const queryClient = useQueryClient();
  const { user, displayName, roles } = useMe();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pm-diverts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("diverts")
        .select("*")
        .in("status", ["open", "sourcing", "available"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function resolve(id: string, status: DivertStatus, note: string) {
    const { error } = await supabase.from("diverts").update({ status, pm_notes: note }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("divert_updates").insert({
      divert_id: id,
      status,
      note: note || `Purchase set status to ${DIVERT_STATUS_LABELS[status]}`,
      actor_id: user?.id ?? null,
      actor_name: displayName,
      actor_role: roles[0] ?? null,
    });
    toast.success("Divert updated");
    queryClient.invalidateQueries({ queryKey: ["pm-diverts"] });
    queryClient.invalidateQueries({ queryKey: ["divert-open-count"] });
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
                <StatusPill tone={STATUS_TONE[row.status]}>
                  {DIVERT_STATUS_LABELS[row.status]}
                </StatusPill>
              </div>
              <p className="text-sm">
                {row.customer_name} · <span className="num">{row.customer_mobile}</span>
              </p>
              <Textarea
                rows={2}
                defaultValue={row.pm_notes ?? ""}
                placeholder="Sourcing notes"
                id={`note-${row.id}`}
                maxLength={500}
              />
              <div className="flex flex-wrap gap-2">
                {(["sourcing", "available", "closed", "cancelled"] as DivertStatus[]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "available" ? "default" : "secondary"}
                    onClick={() => {
                      const el = document.getElementById(`note-${row.id}`) as HTMLTextAreaElement | null;
                      resolve(row.id, status, el?.value ?? "");
                    }}
                  >
                    {DIVERT_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
