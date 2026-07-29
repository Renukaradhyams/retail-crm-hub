import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning" | "destructive";
}) {
  const toneRing: Record<string, string> = {
    default: "bg-primary",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  return (
    <div className="panel relative overflow-hidden p-5">
      <span className={cn("absolute inset-x-0 top-0 h-1", toneRing[tone])} />
      <p className="eyebrow">{label}</p>
      <p className="num mt-2 text-3xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/12 text-info",
  success: "bg-success/14 text-success",
  warning: "bg-warning/18 text-warning-foreground",
  danger: "bg-destructive/12 text-destructive",
  accent: "bg-accent/20 text-accent-foreground",
};

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof STATUS_TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
