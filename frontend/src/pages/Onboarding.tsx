import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const adminSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the admin name").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const storeSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the store name").max(80),
  openHour: z.number().int().min(0).max(23),
  closeHour: z.number().int().min(1).max(23),
  derEmail: z.string().trim().email("Enter a valid DER email").max(255).or(z.literal("")),
});

export function Onboarding() {
  const navigate = useNavigate();
  const { login, token } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [companyName, setCompanyName] = useState("BSC Retail");
  const [openHour, setOpenHour] = useState("10");
  const [closeHour, setCloseHour] = useState("22");
  const [derEmail, setDerEmail] = useState("");

  const [sections, setSections] = useState<string[]>(["Ground Floor", "First Floor", ""]);

  useEffect(() => {
    async function init() {
      try {
        const { data } = await api.get("/auth/setup-status");
        if (data.setupComplete) {
          navigate(token ? "/app" : "/login", { replace: true });
          return;
        }
        if (token) setStep(2);
      } catch (err) {
        console.error("Check setup failed:", err);
      } finally {
        setChecking(false);
      }
    }
    init();
  }, [navigate, token]);

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    const parsed = adminSchema.safeParse({ fullName, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", {
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
      });
      login(data.token, data.user);
      toast.success("Admin account created");
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Could not create the admin account");
    } finally {
      setBusy(false);
    }
  }

  async function saveStore(event: React.FormEvent) {
    event.preventDefault();
    const parsed = storeSchema.safeParse({
      companyName,
      openHour: Number(openHour),
      closeHour: Number(closeHour),
      derEmail,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (parsed.data.closeHour <= parsed.data.openHour) {
      return toast.error("Closing hour must be after the opening hour");
    }
    setBusy(true);
    try {
      await api.put("/crm/settings", {
        company_name: parsed.data.companyName,
        open_hour: parsed.data.openHour,
        close_hour: parsed.data.closeHour,
        der_email: parsed.data.derEmail || null,
      });
      setStep(3);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    const names = sections.map((s) => s.trim()).filter(Boolean);
    if (!names.length) return toast.error("Add at least one floor or section");
    setBusy(true);
    try {
      for (const name of names) {
        await api.post("/crm/sections", { name, section_type: "floor" });
      }
      await api.post("/crm/settings/complete");
      toast.success("Setup complete");
      navigate("/app", { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Could not finish setup");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking store setup…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="panel w-full max-w-lg p-8">
        <p className="eyebrow">Step {step} of 3</p>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {step === 1 ? "Create the admin account" : step === 2 ? "Store details" : "Floors & sections"}
        </h1>

        {step === 1 && (
          <form onSubmit={createAdmin} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fullName">Admin name</label>
              <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <button type="submit" className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium" disabled={busy}>
              {busy ? "Creating…" : "Create admin & continue"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={saveStore} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="company">Store name</label>
              <input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="open">Opening hour (0-23)</label>
                <input
                  id="open"
                  inputMode="numeric"
                  value={openHour}
                  onChange={(e) => setOpenHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="close">Closing hour (0-23)</label>
                <input
                  id="close"
                  inputMode="numeric"
                  value={closeHour}
                  onChange={(e) => setCloseHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="der">DER email (optional)</label>
              <input id="der" value={derEmail} onChange={(e) => setDerEmail(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" />
            </div>
            <button type="submit" className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium" disabled={busy}>
              {busy ? "Saving…" : "Save & continue"}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Add the floors or counters your team works on. You can add more later in Admin.
            </p>
            {sections.map((value, index) => (
              <input
                key={index}
                value={value}
                placeholder={`Section ${index + 1}`}
                onChange={(e) => {
                  const next = [...sections];
                  next[index] = e.target.value;
                  setSections(next);
                }}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            ))}
            <button type="button" className="w-full h-10 rounded-md bg-secondary text-secondary-foreground font-medium" onClick={() => setSections([...sections, ""])}>
              Add another section
            </button>
            <button type="button" className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium" disabled={busy} onClick={finish}>
              {busy ? "Finishing…" : "Finish setup"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
