import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { canAccess } from "@/lib/crm";
import { addDays, formatDMY, istToday } from "@/lib/ist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/attendance")({
  component: AttendancePage,
});

type AttendanceRow = {
  id: string;
  entry_date: string;
  profile_id: string;
  shift_id: string | null;
  status: Status;
  check_in: string | null;
  check_out: string | null;
  worked_minutes: number;
  remarks: string | null;
  marked_by: string | null;
};

type Status = "present" | "absent" | "late" | "half_day" | "leave" | "week_off";

const STATUS_LABELS: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half Day",
  leave: "Leave",
  week_off: "Week Off",
};

const STATUS_TONE: Record<Status, "success" | "danger" | "warning" | "info" | "neutral"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  half_day: "warning",
  leave: "info",
  week_off: "neutral",
};

const STATUSES = Object.keys(STATUS_LABELS) as Status[];

function timeOf(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function AttendancePage() {
  const queryClient = useQueryClient();
  const { user, roles, displayName } = useMe();
  const isAdmin = canAccess(roles, "admin");
  const [tab, setTab] = useState<"today" | "roster" | "shifts">("today");
  const [date, setDate] = useState(istToday());
  const [newShift, setNewShift] = useState({ name: "", start_time: "10:00", end_time: "19:00" });

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => {
      const [people, shifts, attendance, roster] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
        supabase.from("shifts").select("*").eq("is_active", true).order("start_time"),
        supabase.from("attendance_records").select("*").eq("entry_date", date),
        supabase.from("roster_entries").select("*").eq("entry_date", date),
      ]);
      return {
        people: people.data ?? [],
        shifts: shifts.data ?? [],
        attendance: attendance.data ?? [],
        roster: roster.data ?? [],
      };
    },
  });

  const people = data?.people ?? [];
  const shifts = data?.shifts ?? [];
  const attendanceBy = useMemo(
    () => Object.fromEntries((data?.attendance ?? []).map((r) => [r.profile_id, r])),
    [data],
  );
  const rosterBy = useMemo(
    () => Object.fromEntries((data?.roster ?? []).map((r) => [r.profile_id, r])),
    [data],
  );

  const present = (data?.attendance ?? []).filter((r) => r.status === "present" || r.status === "late").length;
  const absent = (data?.attendance ?? []).filter((r) => r.status === "absent").length;
  const onLeave = (data?.attendance ?? []).filter((r) => r.status === "leave").length;
  const unmarked = people.length - (data?.attendance.length ?? 0);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["attendance"] });

  async function upsertAttendance(profileId: string, patch: Partial<AttendanceRow>) {
    const existing = attendanceBy[profileId];
    const payload = {
      entry_date: date,
      profile_id: profileId,
      shift_id: rosterBy[profileId]?.shift_id ?? existing?.shift_id ?? null,
      marked_by: user?.id ?? null,
      ...patch,
    };
    const { error } = existing
      ? await supabase.from("attendance_records").update(patch).eq("id", existing.id)
      : await supabase.from("attendance_records").insert(payload);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function selfPunch(kind: "in" | "out") {
    if (!user) return;
    const now = new Date().toISOString();
    const existing = attendanceBy[user.id];
    if (kind === "in") {
      if (existing?.check_in) return toast.info("Already checked in today");
      await upsertAttendance(user.id, { check_in: now, status: "present" });
      toast.success("Checked in");
    } else {
      if (!existing?.check_in) return toast.error("Check in first");
      const minutes = Math.max(
        0,
        Math.round((Date.now() - new Date(existing.check_in).getTime()) / 60000),
      );
      await upsertAttendance(user.id, { check_out: now, worked_minutes: minutes });
      toast.success("Checked out");
    }
  }

  async function assignShift(profileId: string, shiftId: string) {
    const existing = rosterBy[profileId];
    if (!shiftId) {
      if (existing) {
        const { error } = await supabase.from("roster_entries").delete().eq("id", existing.id);
        if (error) return toast.error(error.message);
      }
      return refresh();
    }
    const { error } = existing
      ? await supabase.from("roster_entries").update({ shift_id: shiftId }).eq("id", existing.id)
      : await supabase
          .from("roster_entries")
          .insert({ entry_date: date, profile_id: profileId, shift_id: shiftId, created_by: user?.id ?? null });
    if (error) return toast.error(error.message);
    refresh();
  }

  async function addShift() {
    if (!newShift.name.trim()) return toast.error("Shift name is required");
    const { error } = await supabase.from("shifts").insert(newShift);
    if (error) return toast.error(error.message);
    setNewShift({ name: "", start_time: "10:00", end_time: "19:00" });
    toast.success("Shift added");
    refresh();
  }

  async function removeShift(id: string) {
    const { error } = await supabase.from("shifts").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  const myRecord = user ? attendanceBy[user.id] : undefined;

  return (
    <div>
      <PageHeader
        title="Attendance & Roster"
        subtitle={`Staff attendance and shift planning · ${formatDMY(date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, -1))}>
              Prev
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[150px]"
            />
            <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>
              Next
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Present" value={present} tone="success" hint={`of ${people.length} staff`} />
        <KpiCard label="Absent" value={absent} tone="destructive" />
        <KpiCard label="On leave" value={onLeave} tone="accent" />
        <KpiCard label="Unmarked" value={Math.max(0, unmarked)} tone="warning" />
      </div>

      <div className="panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">My attendance</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayName} · In {timeOf(myRecord?.check_in ?? null)} · Out{" "}
            {timeOf(myRecord?.check_out ?? null)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => selfPunch("in")} disabled={!!myRecord?.check_in}>
            Check in
          </Button>
          <Button variant="outline" onClick={() => selfPunch("out")} disabled={!!myRecord?.check_out}>
            Check out
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(["today", "roster", "shifts"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {key === "today" ? "Attendance" : key}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="panel p-6 text-sm text-muted-foreground">Loading…</div>
      ) : tab === "shifts" ? (
        <div className="panel p-5">
          {isAdmin && (
            <div className="mb-5 grid gap-3 sm:grid-cols-4">
              <div>
                <Label>Shift name</Label>
                <Input
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  placeholder="e.g. Late Evening"
                />
              </div>
              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  value={newShift.start_time}
                  onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="time"
                  value={newShift.end_time}
                  onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={addShift}>
                  Add shift
                </Button>
              </div>
            </div>
          )}
          {shifts.length === 0 ? (
            <EmptyState title="No shifts" hint="Add a shift to start building the roster." />
          ) : (
            <ul className="divide-y divide-border">
              {shifts.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => removeShift(s.id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : people.length === 0 ? (
        <EmptyState title="No staff" hint="Add team members in Admin → People." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Shift</th>
                {tab === "today" ? (
                  <>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">In</th>
                    <th className="px-4 py-3">Out</th>
                    <th className="px-4 py-3">Hours</th>
                  </>
                ) : (
                  <th className="px-4 py-3">Notes</th>
                )}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const rec = attendanceBy[p.id];
                const ros = rosterBy[p.id];
                const shift = shifts.find((s) => s.id === (rec?.shift_id ?? ros?.shift_id));
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{p.full_name || p.email}</td>
                    <td className="px-4 py-3">
                      {tab === "roster" && isAdmin ? (
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={ros?.shift_id ?? ""}
                          onChange={(e) => assignShift(p.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {shifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{shift?.name ?? "Unassigned"}</span>
                      )}
                    </td>
                    {tab === "today" ? (
                      <>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <select
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={rec?.status ?? ""}
                              onChange={(e) =>
                                upsertAttendance(p.id, { status: e.target.value as Status })
                              }
                            >
                              <option value="">Not marked</option>
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : rec ? (
                            <StatusPill tone={STATUS_TONE[rec.status as Status]}>
                              {STATUS_LABELS[rec.status as Status]}
                            </StatusPill>
                          ) : (
                            <span className="text-muted-foreground">Not marked</span>
                          )}
                        </td>
                        <td className="num px-4 py-3">{timeOf(rec?.check_in ?? null)}</td>
                        <td className="num px-4 py-3">{timeOf(rec?.check_out ?? null)}</td>
                        <td className="num px-4 py-3">
                          {rec?.worked_minutes
                            ? `${Math.floor(rec.worked_minutes / 60)}h ${rec.worked_minutes % 60}m`
                            : "—"}
                        </td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-muted-foreground">{ros?.notes ?? "—"}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
