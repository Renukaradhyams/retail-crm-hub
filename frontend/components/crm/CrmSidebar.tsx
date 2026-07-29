import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Footprints,
  QrCode,
  PhoneCall,
  PackageSearch,
  ClipboardCheck,
  BarChart3,
  Wallet,
  Store,
  Settings,
  Tv,
  HandHeart,
  CalendarClock,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canAccess, type AppRole, type PageKey } from "@/lib/crm";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  page: PageKey;
  badge?: "diverts";
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
      { to: "/app/footfall", label: "Footfall Entry", icon: Footprints, page: "footfall" },
      { to: "/app/cash-settlement", label: "Cash Settlement", icon: Wallet, page: "cash" },
      { to: "/app/vm-checklist", label: "VM Checklist", icon: Store, page: "vmChecklist" },
      { to: "/app/attendance", label: "Attendance & Roster", icon: CalendarClock, page: "attendance" },
    ],
  },
  {
    label: "Customer",
    items: [
      { to: "/app/feedback-qr", label: "Feedback QR", icon: QrCode, page: "feedbackQr" },
      { to: "/app/feedback-list", label: "Call Queue", icon: PhoneCall, page: "feedbackList" },
      {
        to: "/app/divert",
        label: "Sourcing Diverts",
        icon: PackageSearch,
        page: "divert",
        badge: "diverts",
      },
      { to: "/app/pm-view", label: "PM View", icon: ClipboardCheck, page: "pmView" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/app/reports", label: "Reports", icon: BarChart3, page: "reports" },
      { to: "/tv", label: "Live TV Display", icon: Tv, page: "tv" },
      { to: "/greeter", label: "Greeter Portal", icon: HandHeart, page: "greeter" },
      { to: "/app/admin", label: "Admin Settings", icon: Settings, page: "admin" },
    ],
  },
];

export function CrmSidebar({
  roles,
  companyName,
  open,
  onClose,
}: {
  roles: AppRole[];
  companyName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: openDiverts = 0 } = useQuery({
    queryKey: ["divert-open-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("diverts")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "sourcing"]);
      return count ?? 0;
    },
  });

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-primary/40 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
            BSC
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold">{companyName}</p>
            <p className="text-[11px] tracking-wide text-sidebar-foreground/60">Retail CRM</p>
          </div>
          <button onClick={onClose} className="lg:hidden" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => canAccess(roles, item.page));
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge === "diverts" && openDiverts > 0 && (
                            <span className="num rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-bold text-sidebar-primary-foreground">
                              {openDiverts}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4 text-[11px] text-sidebar-foreground/50">
          IST operations · v1.0
        </div>
      </aside>
    </>
  );
}
