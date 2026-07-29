import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

export type PinKind = "tv" | "cash" | "greeter";

const storageKey = (kind: PinKind) => `bsc-pin-${kind}`;

export async function verifyPin(kind: PinKind, pin: string): Promise<boolean> {
  try {
    const { data } = await api.post("/auth/verify-pin", { kind, pin });
    return data.valid === true;
  } catch (err) {
    toast.error("Failed to verify PIN");
    return false;
  }
}

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
          <label htmlFor={`pin-${kind}`} className="text-sm font-medium">PIN</label>
          <input
            id={`pin-${kind}`}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="num h-14 w-full rounded-md border border-input bg-card px-3 text-center text-2xl tracking-[0.4em]"
          />
        </div>
        <button
          type="submit"
          className="mt-4 h-12 w-full rounded-md bg-primary text-primary-foreground font-semibold"
          disabled={busy || pin.length < 4}
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
