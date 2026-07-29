import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/feedback-qr")({
  component: FeedbackQrPage,
});

function FeedbackQrPage() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/feedback`);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("company_name").maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["qr-stats"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("source", "qr");
      return count ?? 0;
    },
  });

  return (
    <>
      <PageHeader
        title="Customer Feedback QR"
        subtitle="Show this on a tablet at the exit or print it for the billing counter."
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="panel flex flex-col items-center gap-4 p-8 text-center">
          <p className="eyebrow">{settings?.company_name ?? "BSC Retail"}</p>
          <h2 className="font-display text-xl font-bold">Scan to share your feedback</h2>
          <div className="rounded-xl bg-card p-4 ring-1 ring-border">
            {url ? <QRCodeSVG value={url} size={220} level="M" /> : <div className="h-[220px] w-[220px]" />}
          </div>
          <p className="text-xs text-muted-foreground break-all">{url}</p>
        </div>

        <div className="space-y-4">
          <div className="panel p-6">
            <p className="eyebrow">QR submissions to date</p>
            <p className="num mt-2 text-4xl font-bold">{stats ?? 0}</p>
          </div>
          <div className="panel p-6">
            <h3 className="font-display text-base font-semibold">How it works</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>1. The customer scans the code and answers up to eight quick questions.</li>
              <li>2. Answers are tagged with the store area they shopped in.</li>
              <li>
                3. Any negative first answer automatically creates a call-back entry in the Call
                Queue.
              </li>
              <li>4. Telecallers work the queue and log attempts, notes and escalations.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
