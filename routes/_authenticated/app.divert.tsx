import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DIVERT_STATUS_LABELS, type DivertStatus } from "@/lib/crm";
import { useMe } from "@/hooks/useMe";
import { formatDMY, istToday } from "@/lib/ist";

export const Route = createFileRoute("/_authenticated/app/divert")({
  component: DivertPage,
});

export const STATUS_TONE: Record<DivertStatus, "info" | "warning" | "success" | "neutral" | "danger"> = {
  open: "info",
  sourcing: "warning",
  available: "success",
  closed: "neutral",
  cancelled: "danger",
};

const EMPTY = {
  section_id: "",
  product_wanted: "",
  quantity: "1",
  price_range: "",
  fabric_occasion: "",
  reason_code: "",
  customer_name: "",
  customer_mobile: "",
  expected_delivery: "",
};

function DivertPage() {
  const queryClient = useQueryClient();
  const { user, displayName, roles } = useMe();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [logFor, setLogFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["diverts"],
    queryFn: async () => {
      const [diverts, sections, reasons] = await Promise.all([
        supabase.from("diverts").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("sections").select("id, name").eq("is_active", true).order("name"),
        supabase.from("divert_reasons").select("code, label").eq("is_active", true),
      ]);
      return {
        diverts: diverts.data ?? [],
        sections: sections.data ?? [],
        reasons: reasons.data ?? [],
      };
    },
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["divert-updates", logFor],
    enabled: !!logFor,
    queryFn: async () => {
      const { data } = await supabase
        .from("divert_updates")
        .select("*")
        .eq("divert_id", logFor!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!form.product_wanted.trim() || !form.customer_name.trim() || !/^\d{10}$/.test(form.customer_mobile)) {
      toast.error("Product, customer name and a 10-digit mobile are required");
      return;
    }
    const section = data?.sections.find((s) => s.id === form.section_id);
    const { data: created, error } = await supabase
      .from("diverts")
      .insert({
        entry_date: istToday(),
        section_id: form.section_id || null,
        section_name: section?.name ?? null,
        product_wanted: form.product_wanted.trim(),
        quantity: Number(form.quantity) || 1,
        price_range: form.price_range.trim() || null,
        fabric_occasion: form.fabric_occasion.trim() || null,
        reason_code: form.reason_code || null,
        customer_name: form.customer_name.trim(),
        customer_mobile: form.customer_mobile,
        expected_delivery: form.expected_delivery || null,
        created_by: user?.id ?? null,
        created_by_name: displayName,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("divert_updates").insert({
      divert_id: created.id,
      status: "open",
      note: "Divert raised",
      actor_id: user?.id ?? null,
      actor_name: displayName,
      actor_role: roles[0] ?? null,
    });
    toast.success("Divert created");
    setForm({ ...EMPTY });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["diverts"] });
    queryClient.invalidateQueries({ queryKey: ["divert-open-count"] });
  }

  async function changeStatus(id: string, status: DivertStatus, note: string) {
    const { error } = await supabase.from("diverts").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("divert_updates").insert({
      divert_id: id,
      status,
      note,
      actor_id: user?.id ?? null,
      actor_name: displayName,
      actor_role: roles[0] ?? null,
    });
    queryClient.invalidateQueries({ queryKey: ["diverts"] });
    queryClient.invalidateQueries({ queryKey: ["divert-open-count"] });
    queryClient.invalidateQueries({ queryKey: ["divert-updates", id] });
  }

  function sendDer() {
    const openRows = (data?.diverts ?? []).filter((row) => row.status === "open" || row.status === "sourcing");
    const body = openRows
      .map((row) => `#${row.ref_no} ${row.product_wanted} (${row.section_name ?? "—"}) — ${row.customer_name}`)
      .join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(
      `Divert Exception Report ${formatDMY(istToday())}`,
    )}&body=${encodeURIComponent(body || "No open diverts.")}`;
  }

  return (
    <>
      <PageHeader
        title="Sourcing Diverts"
        subtitle="Lost demand captured on the floor and routed to purchase."
        actions={
          <>
            <Button variant="secondary" onClick={sendDer}>
              <Mail className="mr-2 h-4 w-4" /> Send DER
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New divert
            </Button>
          </>
        }
      />

      {isLoading ? (
        <EmptyState title="Loading diverts…" />
      ) : (data?.diverts.length ?? 0) === 0 ? (
        <EmptyState title="No diverts yet" hint="Raise one when a customer leaves without a purchase." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-secondary/60 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Ref</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold">Section</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">PM action</th>
                <th className="px-5 py-3 text-right font-semibold">Log</th>
              </tr>
            </thead>
            <tbody>
              {(data?.diverts ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="num px-5 py-3">#{row.ref_no}</td>
                  <td className="num px-3 py-3 text-xs">{formatDMY(row.entry_date)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.product_wanted}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty {row.quantity} · {row.price_range ?? "any price"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.section_name ?? "—"}</td>
                  <td className="px-3 py-3">
                    <p>{row.customer_name}</p>
                    <p className="num text-xs text-muted-foreground">{row.customer_mobile}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill tone={STATUS_TONE[row.status]}>
                      {DIVERT_STATUS_LABELS[row.status]}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        changeStatus(row.id, e.target.value as DivertStatus, "Status updated")
                      }
                      className="h-9 rounded-md border border-input bg-card px-2 text-xs"
                    >
                      {Object.entries(DIVERT_STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setLogFor(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New sourcing divert</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Section</Label>
                <select
                  value={form.section_id}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Select</option>
                  {(data?.sections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <select
                  value={form.reason_code}
                  onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  <option value="">Select</option>
                  {(data?.reasons ?? []).map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Product wanted</Label>
              <Textarea
                rows={2}
                maxLength={300}
                value={form.product_wanted}
                onChange={(e) => setForm({ ...form, product_wanted: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/\D/g, "") })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price range</Label>
                <Input
                  value={form.price_range}
                  onChange={(e) => setForm({ ...form, price_range: e.target.value })}
                  placeholder="₹2000–4000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fabric / occasion</Label>
                <Input
                  value={form.fabric_occasion}
                  onChange={(e) => setForm({ ...form, fabric_occasion: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Customer name</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile</Label>
                <Input
                  inputMode="numeric"
                  value={form.customer_mobile}
                  onChange={(e) =>
                    setForm({ ...form, customer_mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expected delivery</Label>
                <Input
                  type="date"
                  value={form.expected_delivery}
                  onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create divert
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!logFor} onOpenChange={(o) => !o && setLogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activity log</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3">
            {updates.map((entry) => (
              <li key={entry.id} className="border-l-2 border-accent pl-3">
                <p className="text-sm font-medium">
                  {entry.status ? DIVERT_STATUS_LABELS[entry.status] : "Note"} — {entry.note}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.actor_name ?? "System"} · {new Date(entry.created_at).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
            {!updates.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
