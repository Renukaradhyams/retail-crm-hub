import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDMY, istHour, istToday, slotLabel } from "@/lib/ist";
import { PinGate } from "@/components/crm/PinGate";

export const Route = createFileRoute("/greeter")({
  head: () => ({
    meta: [
      { title: "Greeter Entry — BSC Retail CRM" },
      { name: "description", content: "Tablet-friendly hourly visitor counter for store greeters." },
      { property: "og:title", content: "Greeter Entry — BSC Retail CRM" },
      { property: "og:description", content: "Tablet-friendly hourly visitor counter for store greeters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GreeterPage,
});

function GreeterPage() {
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
  const queryClient = useQueryClient();
  const today = istToday();
  const hour = istHour();
  const [count, setCount] = useState(0);

  const { data: entry } = useQuery({
    queryKey: ["greeter", today, hour],
    queryFn: async () => {
      const { data } = await supabase
        .from("footfall_entries")
        .select("*")
        .eq("entry_date", today)
        .eq("slot_hour", hour)
        .maybeSingle();
      return data;
    },
  });

  async function save() {
    const { error } = await supabase.from("footfall_entries").upsert(
      { entry_date: today, slot_hour: hour, visitors: count },
      { onConflict: "entry_date,slot_hour" },
    );
    if (error) return toast.error(error.message);
    toast.success(`Saved ${count} visitors for ${slotLabel(hour)}`);
    setCount(0);
    queryClient.invalidateQueries({ queryKey: ["greeter", today, hour] });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-10">
      <div className="text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{formatDMY(today)}</p>
        <h1 className="font-display text-3xl font-bold">{slotLabel(hour)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Already recorded this slot: <span className="num">{entry?.visitors ?? 0}</span>
        </p>
      </div>

      <div className="flex items-center gap-8">
        <Button
          size="icon"
          variant="secondary"
          className="h-24 w-24 rounded-full"
          onClick={() => setCount((c) => Math.max(0, c - 1))}
        >
          <Minus className="h-10 w-10" />
        </Button>
        <span className="num w-40 text-center text-7xl font-bold">{count}</span>
        <Button size="icon" className="h-24 w-24 rounded-full" onClick={() => setCount((c) => c + 1)}>
          <Plus className="h-10 w-10" />
        </Button>
      </div>

      <Button className="h-14 w-full max-w-sm text-lg" onClick={save}>
        Save to slot
      </Button>
    </main>
  );
}
