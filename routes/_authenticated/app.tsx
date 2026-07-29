import { useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, LogOut, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { useMe } from "@/hooks/useMe";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { ROLE_LABELS } from "@/lib/crm";
import { formatDMY, istToday } from "@/lib/ist";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { roles, displayName, loading } = useMe();

  useRealtimeAlerts();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <CrmSidebar
        roles={roles}
        companyName={settings?.company_name ?? "BSC Retail"}
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
                {loading
                  ? "…"
                  : roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role assigned"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
