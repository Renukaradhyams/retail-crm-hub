import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PinKind = "tv" | "cash" | "greeter";

const storageKey = (kind: PinKind) => `bsc-pin-${kind}`;

export async function verifyPin(kind: PinKind, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_access_pin", { _kind: kind, _pin: pin });
  if (error) {
    toast.error(error.message);
    return false;
  }
  return data === true;
}

/** Wraps a screen behind a shared device PIN stored in the backend. */
export function PinGate({
  kind,
  title,
  description,
  fullscreen = false,
  children,
}: {
  kind: PinKind;
  title: string;
  description: string;
  fullscreen?: boolean;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(storageKey(kind)) === "1") setUnlocked(true);
  }, [kind]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ok = await verifyPin(kind, pin);
    setBusy(false);
    if (!ok) {
      toast.error("Incorrect PIN");
      setPin("");
      return;
    }
    sessionStorage.setItem(storageKey(kind), "1");
    setUnlocked(true);
  }

  if (unlocked) return <>{children}</>;

  return (
    <div
      className={
        fullscreen
          ? "flex min-h-screen items-center justify-center bg-background px-6"
          : "mx-auto max-w-sm"
      }
    >
      <form onSubmit={submit} className="panel w-full max-w-sm p-8 text-center">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 space-y-2 text-left">
          <Label htmlFor={`pin-${kind}`}>PIN</Label>
          <Input
            id={`pin-${kind}`}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="num h-14 text-center text-2xl tracking-[0.4em]"
          />
        </div>
        <Button type="submit" className="mt-4 h-12 w-full" disabled={busy || pin.length < 4}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
