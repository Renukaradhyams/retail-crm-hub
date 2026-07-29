import type { UserRole } from "@/context/AuthContext";

export type AppRole = UserRole;
export type DivertStatus = "open" | "sourcing" | "available" | "closed" | "cancelled";
export type CallStatus = "new" | "called" | "resolved" | "escalated";
export type VmShift = "opening" | "mid_day" | "closing";
export type VmScore = "pass" | "fail" | "na";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  crm_manager: "CRM Manager",
  crm_staff: "CRM Staff",
  telecaller: "Telecaller",
  purchase_manager: "Purchase Manager",
  vm: "Visual Merchandiser",
  greeter: "Greeter",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

export const PAGE_ACCESS = {
  dashboard: ["crm_manager", "crm_staff", "telecaller", "purchase_manager"],
  footfall: ["crm_manager", "crm_staff"],
  feedbackQr: ["crm_manager", "crm_staff"],
  feedbackList: ["crm_manager", "telecaller"],
  divert: ["crm_manager", "crm_staff", "purchase_manager"],
  pmView: ["purchase_manager"],
  reports: ["crm_manager"],
  cash: ["crm_manager"],
  vmChecklist: ["crm_manager", "vm"],
  attendance: ["crm_manager", "crm_staff", "telecaller", "purchase_manager", "vm", "greeter"],
  admin: [] as AppRole[],
  tv: ["crm_manager"],
  greeter: ["greeter", "crm_manager"],
} satisfies Record<string, AppRole[]>;

export type PageKey = keyof typeof PAGE_ACCESS;

export function canAccess(roles: AppRole[], page: PageKey): boolean {
  if (roles.includes("super_admin")) return true;
  if (roles.includes("admin")) return true;
  return PAGE_ACCESS[page].some((r) => roles.includes(r));
}

export const DIVERT_STATUS_LABELS: Record<DivertStatus, string> = {
  open: "Open",
  sourcing: "Sourcing",
  available: "Available",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  new: "New",
  called: "Called",
  resolved: "Resolved",
  escalated: "Escalated",
};

export const VM_SHIFT_LABELS: Record<VmShift, string> = {
  opening: "Opening",
  mid_day: "Mid-Day",
  closing: "Closing",
};

export type FeedbackAnswer = { q: string; a: string };

export function scoreFeedback(rows: { answers: unknown }[]) {
  let promoters = 0;
  let detractors = 0;
  let positive = 0;
  let total = 0;
  for (const row of rows) {
    const answers = (Array.isArray(row.answers) ? row.answers : []) as FeedbackAnswer[];
    answers.forEach((ans, index) => {
      const value = (ans?.a ?? "").toLowerCase();
      if (!value) return;
      total += 1;
      if (value === "yes") positive += 1;
      if (index === 0) {
        if (value === "yes") promoters += 1;
        if (value === "no") detractors += 1;
      }
    });
  }
  const base = rows.length || 1;
  return {
    nps: Math.round(((promoters - detractors) / base) * 100),
    csi: total ? Math.round((positive / total) * 100) : 0,
  };
}

export function isNegative(answers: FeedbackAnswer[]): boolean {
  const first = (answers[0]?.a ?? "").toLowerCase();
  return first === "no" || first === "maybe";
}
