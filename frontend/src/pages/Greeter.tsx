import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDMY, istHour, istToday, slotLabel } from "@/lib/ist";
import { PinGate } from "@/components/crm/PinGate";

export function Greeter() {
  return (
    <PinGate
      kind="greeter"
      fullscreen
      title="Greeter entry"
      description="Enter the greeter PIN to start counting visitors."
    >
      <GreeterCounter />
    </PinGate>
  );
}

function GreeterCounter() {
  const today = istToday();
  const hour = istHour();
  const [count, setCount] = useState(0);
  const [recordedCount, setRecordedCount] = useState(0);

  async function fetchCurrentSlot() {
    try {
      const res = await api.get(`/crm/footfall?date=${today}`);
      const entry = (res.data || []).find((e: any) => e.slot_hour === hour);
      setRecordedCount(entry?.visitors ?? 0);
    } catch (err) {
      console.error("Failed to load greeter slot count", err);
    }
  }

  useEffect(() => {
    fetchCurrentSlot();
  }, [today, hour]);

  async function save() {
    try {
      await api.post("/crm/footfall/upsert", {
        entry_date: today,
        slot_hour: hour,
        visitors: count,
      });
      toast.success(`Saved ${count} visitors for ${slotLabel(hour)}`);
      setCount(0);
      fetchCurrentSlot();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save to slot");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-10">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{formatDMY(today)}</p>
        <h1 className="font-display text-3xl font-bold">{slotLabel(hour)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Already recorded this slot: <span className="num">{recordedCount}</span>
        </p>
      </div>

      <div className="flex items-center gap-8">
        <button
          className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          onClick={() => setCount((c) => Math.max(0, c - 1))}
        >
          <Minus className="h-10 w-10" />
        </button>
        <span className="num w-40 text-center text-7xl font-bold">{count}</span>
        <button
          className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => setCount((c) => c + 1)}
        >
          <Plus className="h-10 w-10" />
        </button>
      </div>

      <button className="h-14 w-full max-w-sm rounded-md bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-colors" onClick={save}>
        Save to slot
      </button>
    </main>
  );
}
