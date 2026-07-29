import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { verifyPin } from "@/components/crm/PinGate";
import api from "@/lib/api";
import { KpiCard, PageHeader } from "@/components/crm/ui";
import { useAuth } from "@/context/AuthContext";
import { formatDMY, inr, istToday } from "@/lib/ist";

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

export function CashSettlement() {
  const { displayName } = useAuth();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [date, setDate] = useState(istToday());
  const [counters, setCounters] = useState<Counter[]>([emptyCounter(1)]);

  async function loadSettlement() {
    if (!unlocked) return;
    try {
      const res = await api.get(`/cash?date=${date}`);
      if (res.data?.rows?.length) {
        setCounters(
          res.data.rows.map((row: any) => ({
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
      } else {
        setCounters([emptyCounter(1)]);
      }
    } catch (err) {
      console.error("Failed to load cash settlement", err);
    }
  }

  useEffect(() => {
    loadSettlement();
  }, [date, unlocked]);

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
    try {
      await api.post("/cash/save", {
        entry_date: date,
        sale_amount: totals.sale,
        bills_count: totals.bills,
        cash_total: totals.cash,
        card_total: totals.card,
        upi_total: totals.upi,
        counters: counters.map((c) => ({
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
      });
      toast.success("Settlement saved");
      loadSettlement();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save settlement");
    }
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
            <label htmlFor="pin" className="text-sm font-medium">PIN</label>
            <input
              id="pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm num"
            />
          </div>
          <button
            className="mt-4 h-10 w-full rounded-md bg-primary text-primary-foreground font-medium"
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
          </button>
        </div>
      </div>
    );
  }

  const field = (index: number, key: keyof Counter, label: string) => (
    <div className="space-y-1">
      <label className="text-[11px] font-medium">{label}</label>
      <input
        value={counters[index][key]}
        onChange={(e) => {
          const next = [...counters];
          next[index] = { ...next[index], [key]: e.target.value };
          setCounters(next);
        }}
        className="num h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
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
            <input type="date" value={date} max={istToday()} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 text-sm w-44" />
            <button
              onClick={() => setCounters([...counters, emptyCounter(counters.length + 1)])}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" /> Counter
            </button>
            <button
              onClick={save}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Save className="mr-2 h-4 w-4" /> Save
            </button>
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
                <label className="text-[11px] font-medium">Counter</label>
                <input
                  value={counter.counter_name}
                  onChange={(e) => {
                    const next = [...counters];
                    next[index] = { ...next[index], counter_name: e.target.value };
                    setCounters(next);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium">Cashier</label>
                <input
                  value={counter.cashier_name}
                  onChange={(e) => {
                    const next = [...counters];
                    next[index] = { ...next[index], cashier_name: e.target.value };
                    setCounters(next);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
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
