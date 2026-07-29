import React, { useState, useEffect } from "react";
import { Plus, Mail } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { EmptyState, PageHeader, StatusPill } from "@/components/crm/ui";
import { DIVERT_STATUS_LABELS, type DivertStatus } from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import { formatDMY, istToday } from "@/lib/ist";

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

export function Divert() {
  const { user, displayName, roles } = useAuth();
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [logFor, setLogFor] = useState<string | null>(null);
  const [diverts, setDiverts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setIsLoading(true);
    try {
      const [divertsRes, sectionsRes, reasonsRes] = await Promise.all([
        api.get("/crm/diverts"),
        api.get("/crm/sections"),
        api.get("/crm/divert-reasons"),
      ]);
      setDiverts(divertsRes.data || []);
      setSections(sectionsRes.data || []);
      setReasons(reasonsRes.data || []);
    } catch (err) {
      console.error("Failed to load diverts data", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadUpdates() {
      if (!logFor) return;
      try {
        const res = await api.get(`/crm/diverts/${logFor}/updates`);
        setUpdates(res.data || []);
      } catch (err) {
        console.error("Failed to load divert updates", err);
      }
    }
    loadUpdates();
  }, [logFor]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!form.product_wanted.trim() || !form.customer_name.trim() || !/^\d{10}$/.test(form.customer_mobile)) {
      toast.error("Product, customer name and a 10-digit mobile are required");
      return;
    }
    const section = sections.find((s) => s.id === form.section_id);
    try {
      await api.post("/crm/diverts", {
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
      });
      toast.success("Divert created");
      setForm({ ...EMPTY });
      setOpenModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create divert");
    }
  }

  async function changeStatus(id: string, status: DivertStatus, note: string) {
    try {
      await api.patch(`/crm/diverts/${id}`, { status, note });
      toast.success("Status updated");
      loadData();
      if (logFor === id) {
        const res = await api.get(`/crm/diverts/${id}/updates`);
        setUpdates(res.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  }

  function sendDer() {
    const openRows = diverts.filter((row) => row.status === "open" || row.status === "sourcing");
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
            <button
              onClick={sendDer}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Mail className="mr-2 h-4 w-4" /> Send DER
            </button>
            <button
              onClick={() => setOpenModal(true)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" /> New divert
            </button>
          </>
        }
      />

      {isLoading ? (
        <EmptyState title="Loading diverts…" />
      ) : diverts.length === 0 ? (
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
              {diverts.map((row) => (
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
                    <StatusPill tone={STATUS_TONE[row.status as DivertStatus]}>
                      {DIVERT_STATUS_LABELS[row.status as DivertStatus]}
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
                    <button
                      onClick={() => setLogFor(row.id)}
                      className="h-8 px-3 text-xs font-medium text-foreground hover:bg-secondary rounded-md"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl font-bold">New sourcing divert</h2>
            <form onSubmit={create} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Section</label>
                  <select
                    value={form.section_id}
                    onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Select</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reason</label>
                  <select
                    value={form.reason_code}
                    onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Select</option>
                    {reasons.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Product wanted</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={form.product_wanted}
                  onChange={(e) => setForm({ ...form, product_wanted: e.target.value })}
                  className="w-full rounded-md border border-input bg-card p-3 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quantity</label>
                  <input
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/\D/g, "") })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Price range</label>
                  <input
                    value={form.price_range}
                    onChange={(e) => setForm({ ...form, price_range: e.target.value })}
                    placeholder="₹2000–4000"
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fabric / occasion</label>
                  <input
                    value={form.fabric_occasion}
                    onChange={(e) => setForm({ ...form, fabric_occasion: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Customer name</label>
                  <input
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Mobile</label>
                  <input
                    inputMode="numeric"
                    value={form.customer_mobile}
                    onChange={(e) =>
                      setForm({ ...form, customer_mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Expected delivery</label>
                  <input
                    type="date"
                    value={form.expected_delivery}
                    onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="h-10 flex-1 rounded-md bg-primary text-primary-foreground font-medium">
                  Create divert
                </button>
                <button type="button" onClick={() => setOpenModal(false)} className="h-10 px-4 rounded-md border border-input bg-card text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {logFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-lg p-6 space-y-4">
            <h2 className="font-display text-xl font-bold">Activity log</h2>
            <ul className="space-y-3 max-h-60 overflow-y-auto">
              {updates.map((entry) => (
                <li key={entry.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-medium">
                    {entry.status ? DIVERT_STATUS_LABELS[entry.status as DivertStatus] : "Note"} — {entry.note}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor_name ?? "System"} · {new Date(entry.created_at).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
              {!updates.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </ul>
            <div className="flex justify-end pt-2">
              <button onClick={() => setLogFor(null)} className="h-9 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
