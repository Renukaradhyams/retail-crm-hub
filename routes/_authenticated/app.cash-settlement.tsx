import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { verifyPin } from "@/components/crm/PinGate";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard, PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { formatDMY, inr, istToday } from "@/lib/ist";

export const Route = createFileRoute("/_authenticated/app/cash-settlement")({
  component: CashPage,
});

type Counter = {
  counter_name: string;
  cashier_name: string;
  bills_count: string;
  sale_amount: string;
  cash_amount: string;
  card_amount: string;
  upi_amount: string;
  staff_discount: string;
  customer_discount: string;
};

const emptyCounter = (n: number): Counter => ({
  counter_name: `Counter ${n}`,
  cashier_name: "",
  bills_count: "0",
  sale_amount: "0",
  cash_amount: "0",
  card_amount: "0",
  upi_amount: "0",
  staff_discount: "0",
  customer_discount: "0",
});

function CashPage() {
  const queryClient = useQueryClient();
  const { user, displayName } = useMe();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [date, setDate] = useState(istToday());
  const [counters, setCounters] = useState<Counter[]>([emptyCounter(1)]);

  const { data } = useQuery({
    queryKey: ["cash", date],
    enabled: unlocked,
    queryFn: async () => {
      const { data: settlement } = await supabase
        .from("cash_settlements")
        .select("*")
        .eq("entry_date", date)
        .maybeSingle();
      const { data: rows } = settlement
        ? await supabase.from("cash_counter_reports").select("*").eq("settlement_id", settlement.id)
        : { data: [] };
      return { settlement, rows: rows ?? [] };
    },
  });

  useEffect(() => {
    if (data?.rows.length) {
      setCounters(
        data.rows.map((row) => ({
          counter_name: row.counter_name,
          cashier_name: row.cashier_name ?? "",
          bills_count: String(row.bills_count),
          sale_amount: String(row.sale_amount),
          cash_amount: String(row.cash_amount),
          card_amount: String(row.card_amount),
          upi_amount: String(row.upi_amount),
          staff_discount: String(row.staff_discount),
          customer_discount: String(row.customer_discount),
        })),
      );
    }
  }, [data]);

  const num = (v: string) => Number(v) || 0;
  const totals = counters.reduce(
    (acc, c) => ({
      bills: acc.bills + num(c.bills_count),
      sale: acc.sale + num(c.sale_amount),
      cash: acc.cash + num(c.cash_amount),
      card: acc.card + num(c.card_amount),
      upi: acc.upi + num(c.upi_amount),
    }),
    { bills: 0, sale: 0, cash: 0, card: 0, upi: 0 },
  );
  const abv = totals.bills ? Math.round(totals.sale / totals.bills) : 0;
  const difference = totals.sale - (totals.cash + totals.card + totals.upi);

  async function save() {
    const { data: settlement, error } = await supabase
      .from("cash_settlements")
      .upsert(
        {
          entry_date: date,
          sale_amount: totals.sale,
          bills_count: totals.bills,
          cash_total: totals.cash,
          card_total: totals.card,
          upi_total: totals.upi,
          submitted_by: user?.id ?? null,
          submitted_by_name: displayName,
        },
        { onConflict: "entry_date" },
      )
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("cash_counter_reports").delete().eq("settlement_id", settlement.id);
    const { error: insertError } = await supabase.from("cash_counter_reports").insert(
      counters.map((c) => ({
        settlement_id: settlement.id,
        counter_name: c.counter_name,
        cashier_name: c.cashier_name || null,
        bills_count: num(c.bills_count),
        sale_amount: num(c.sale_amount),
        cash_amount: num(c.cash_amount),
        card_amount: num(c.card_amount),
        upi_amount: num(c.upi_amount),
        staff_discount: num(c.staff_discount),
        customer_discount: num(c.customer_discount),
      })),
    );
    if (insertError) {
      toast.error(insertError.message);
      return;
    }
    toast.success("Settlement saved");
    queryClient.invalidateQueries({ queryKey: ["cash", date] });
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="panel p-8">
          <h1 className="font-display text-xl font-bold">Cash settlement access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the cash-desk PIN to open today&apos;s settlement.
          </p>
          <div className="mt-5 space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
            />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={async () => {
              if (pin.length < 4) return toast.error("Enter at least 4 digits");
              const ok = await verifyPin("cash", pin);
              if (!ok) {
                setPin("");
                return toast.error("Incorrect PIN");
              }
              setUnlocked(true);
            }}
          >
            Unlock
          </Button>
        </div>
      </div>
    );
  }

  const field = (index: number, key: keyof Counter, label: string) => (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        value={counters[index][key]}
        onChange={(e) => {
          const next = [...counters];
          next[index] = { ...next[index], [key]: e.target.value };
          setCounters(next);
        }}
        className="num h-9"
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Cash Settlement"
        subtitle={`Counter-wise reconciliation for ${formatDMY(date)}`}
        actions={
          <>
            <Input type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} className="w-44" />
            <Button variant="secondary" onClick={() => setCounters([...counters, emptyCounter(counters.length + 1)])}>
              <Plus className="mr-2 h-4 w-4" /> Counter
            </Button>
            <Button onClick={save}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Sale Amount" value={inr(totals.sale)} />
        <KpiCard label="Bills" value={totals.bills} tone="accent" />
        <KpiCard label="ABV" value={inr(abv)} tone="success" />
        <KpiCard label="Collected" value={inr(totals.cash + totals.card + totals.upi)} />
        <KpiCard
          label="Difference"
          value={inr(difference)}
          tone={difference === 0 ? "success" : "destructive"}
        />
      </div>

      <div className="mt-6 space-y-4">
        {counters.map((counter, index) => (
          <div key={index} className="panel p-5">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-[11px]">Counter</Label>
                <Input
                  value={counter.counter_name}
                  onChange={(e) => {
                    const next = [...counters];
                    next[index] = { ...next[index], counter_name: e.target.value };
                    setCounters(next);
                  }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Cashier</Label>
                <Input
                  value={counter.cashier_name}
                  onChange={(e) => {
                    const next = [...counters];
                    next[index] = { ...next[index], cashier_name: e.target.value };
                    setCounters(next);
                  }}
                  className="h-9"
                />
              </div>
              {field(index, "bills_count", "Bills")}
              {field(index, "sale_amount", "Sale")}
              {field(index, "cash_amount", "Cash")}
              {field(index, "card_amount", "Card")}
              {field(index, "upi_amount", "UPI")}
              {field(index, "staff_discount", "Staff disc.")}
              {field(index, "customer_discount", "Cust. disc.")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
