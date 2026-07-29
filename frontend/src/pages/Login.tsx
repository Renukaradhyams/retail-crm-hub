import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  fullName: z.string().trim().max(80).optional(),
});

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const { login, token } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const { data } = await api.get("/auth/setup-status");
        if (!data.setupComplete) {
          navigate("/onboard", { replace: true });
          return;
        }
        if (token) {
          if (next) window.location.href = next;
          else navigate("/app", { replace: true });
        }
      } catch (err) {
        console.error("Check setup error:", err);
      }
    }
    checkSetup();
  }, [navigate, next, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data } = await api.post("/auth/register", {
          email: parsed.data.email,
          password: parsed.data.password,
          fullName: parsed.data.fullName || "",
        });
        login(data.token, data.user);
        toast.success("Account created. Signing you in…");
      } else {
        const { data } = await api.post("/auth/login", {
          email: parsed.data.email,
          password: parsed.data.password,
        });
        login(data.token, data.user);
        toast.success("Welcome back!");
      }
      if (next) window.location.href = next;
      else navigate("/app", { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
            BSC
          </div>
          <span className="font-display text-base font-semibold">BSC Retail CRM</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            The store floor, hour by hour.
          </h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Footfall, feedback, diverts, cash and visual merchandising in one console — built for
            IST store operations.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/40">
          The first account created becomes the super admin.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={submit} className="panel w-full max-w-sm p-8">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signin" ? "Staff sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Use the email your admin registered."
              : "Set up the first admin account for your store."}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Priya Nair"
                  maxLength={80}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.com"
                required
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 h-10 w-full rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            disabled={busy}
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin"
              ? "First time here? Create an account"
              : "Already registered? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
