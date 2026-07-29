import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Menu, LogOut, CalendarDays } from "lucide-react";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";
import api from "@/lib/api";

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("BSC Retail");
  const navigate = useNavigate();
  const { user, roles, displayName, logout } = useAuth();

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await api.get("/crm/settings");
        if (data && data.company_name) {
          setCompanyName(data.company_name);
        }
      } catch (err) {
        console.error("Failed to load settings in AppLayout", err);
      }
    }
    fetchSettings();
  }, []);

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <CrmSidebar
        roles={roles}
        companyName={companyName}
        open={open}
        onClose={() => setOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <CalendarDays className="h-4 w-4" />
            <span className="num">{formatDMY(istToday())}</span>
            <span className="text-xs">IST</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">
                {roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role assigned"}
              </p>
            </div>
            <button
              onClick={signOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent text-foreground transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
