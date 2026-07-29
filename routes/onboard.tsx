import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store Setup — BSC Retail CRM" },
      {
        name: "description",
        content: "First-time setup for the BSC Retail CRM: create the admin account and configure the store.",
      },
      { property: "og:title", content: "Store Setup — BSC Retail CRM" },
      { property: "og:description", content: "Create the admin account and configure store hours and sections." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardPage,
});

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

function OnboardPage() {
  const navigate = useNavigate();
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
    (async () => {
      const [{ data: settings }, { data: session }] = await Promise.all([
        supabase.from("settings").select("setup_complete, company_name").maybeSingle(),
        supabase.auth.getSession(),
      ]);
      if (settings?.setup_complete) {
        navigate({ to: session.session ? "/app" : "/auth", replace: true });
        return;
      }
      if (settings?.company_name) setCompanyName(settings.company_name);
      if (session.session) setStep(2);
      setChecking(false);
    })();
  }, [navigate]);

  async function createAdmin(event: React.FormEvent) {
    event.preventDefault();
    const parsed = adminSchema.safeParse({ fullName, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboard`,
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signInError) throw signInError;
      }
      toast.success("Admin account created");
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the admin account");
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
    const { error } = await supabase.from("settings").upsert({
      id: true,
      company_name: parsed.data.companyName,
      open_hour: parsed.data.openHour,
      close_hour: parsed.data.closeHour,
      der_email: parsed.data.derEmail || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setStep(3);
  }

  async function finish() {
    const names = sections.map((s) => s.trim()).filter(Boolean);
    if (!names.length) return toast.error("Add at least one floor or section");
    setBusy(true);
    try {
      const { error: sectionError } = await supabase
        .from("sections")
        .insert(names.map((name) => ({ name, section_type: "floor" })));
      if (sectionError) throw sectionError;
      const { error } = await supabase.from("settings").update({ setup_complete: true }).eq("id", true);
      if (error) throw error;
      toast.success("Setup complete");
      navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish setup");
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
              <Label htmlFor="fullName">Admin name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create admin & continue"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={saveStore} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Store name</Label>
              <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="open">Opening hour (0-23)</Label>
                <Input
                  id="open"
                  inputMode="numeric"
                  value={openHour}
                  onChange={(e) => setOpenHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close">Closing hour (0-23)</Label>
                <Input
                  id="close"
                  inputMode="numeric"
                  value={closeHour}
                  onChange={(e) => setCloseHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="der">DER email (optional)</Label>
              <Input id="der" value={derEmail} onChange={(e) => setDerEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save & continue"}
            </Button>
          </form>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Add the floors or counters your team works on. You can add more later in Admin.
            </p>
            {sections.map((value, index) => (
              <Input
                key={index}
                value={value}
                placeholder={`Section ${index + 1}`}
                onChange={(e) => {
                  const next = [...sections];
                  next[index] = e.target.value;
                  setSections(next);
                }}
              />
            ))}
            <Button variant="secondary" className="w-full" onClick={() => setSections([...sections, ""])}>
              Add another section
            </Button>
            <Button className="w-full" disabled={busy} onClick={finish}>
              {busy ? "Finishing…" : "Finish setup"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
