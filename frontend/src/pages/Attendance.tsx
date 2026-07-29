import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { EmptyState, KpiCard, PageHeader, StatusPill } from "@/components/crm/ui";
import { useAuth } from "@/context/AuthContext";
import { canAccess } from "@/lib/crm";
import { addDays, formatDMY, istToday } from "@/lib/ist";
import { cn } from "@/lib/utils";

type AttendanceRow = {
  id: string;
  entry_date: string;
  user_id: string;
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

export function Attendance() {
  const { user, roles, displayName } = useAuth();
  const isAdmin = canAccess(roles, "admin");
  const [tab, setTab] = useState<"today" | "roster" | "shifts">("today");
  const [date, setDate] = useState(istToday());
  const [newShift, setNewShift] = useState({ name: "", start_time: "10:00", end_time: "19:00" });
  const [data, setData] = useState<{ people: any[]; shifts: any[]; attendance: any[]; roster: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);
    try {
      const res = await api.get(`/attendance?date=${date}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to load attendance", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [date]);

  const people = data?.people ?? [];
  const shifts = data?.shifts ?? [];
  const attendanceBy = useMemo(
    () => Object.fromEntries((data?.attendance ?? []).map((r: any) => [r.user_id, r])),
    [data],
  );
  const rosterBy = useMemo(
    () => Object.fromEntries((data?.roster ?? []).map((r: any) => [r.user_id, r])),
    [data],
  );

  const present = (data?.attendance ?? []).filter((r: any) => r.status === "present" || r.status === "late").length;
  const absent = (data?.attendance ?? []).filter((r: any) => r.status === "absent").length;
  const onLeave = (data?.attendance ?? []).filter((r: any) => r.status === "leave").length;
  const unmarked = people.length - (data?.attendance.length ?? 0);

  async function upsertAttendance(userId: string, patch: Partial<AttendanceRow>) {
    try {
      await api.post("/attendance/upsert", {
        entry_date: date,
        user_id: userId,
        shift_id: rosterBy[userId]?.shift_id ?? attendanceBy[userId]?.shift_id ?? null,
        ...patch,
      });
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update attendance");
    }
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

  async function assignShift(userId: string, shiftId: string) {
    try {
      await api.post("/attendance/roster", {
        entry_date: date,
        user_id: userId,
        shift_id: shiftId,
      });
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to assign shift");
    }
  }

  async function addShift() {
    if (!newShift.name.trim()) return toast.error("Shift name is required");
    try {
      await api.post("/attendance/shifts", newShift);
      setNewShift({ name: "", start_time: "10:00", end_time: "19:00" });
      toast.success("Shift added");
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add shift");
    }
  }

  async function removeShift(id: string) {
    try {
      await api.delete(`/attendance/shifts/${id}`);
      refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to remove shift");
    }
  }

  const myRecord = user ? attendanceBy[user.id] : undefined;

  return (
    <div>
      <PageHeader
        title="Attendance & Roster"
        subtitle={`Staff attendance and shift planning · ${formatDMY(date)}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 rounded-md border border-input bg-card text-xs font-medium"
              onClick={() => setDate(addDays(date, -1))}
            >
              Prev
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-[140px] rounded-md border border-input bg-card px-2 text-xs"
            />
            <button
              className="h-8 px-3 rounded-md border border-input bg-card text-xs font-medium"
              onClick={() => setDate(addDays(date, 1))}
            >
              Next
            </button>
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
          <button
            onClick={() => selfPunch("in")}
            disabled={!!myRecord?.check_in}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
          >
            Check in
          </button>
          <button
            onClick={() => selfPunch("out")}
            disabled={!!myRecord?.check_out}
            className="h-9 px-4 rounded-md border border-input bg-card font-medium text-sm disabled:opacity-50"
          >
            Check out
          </button>
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
                <label className="text-xs font-medium">Shift name</label>
                <input
                  value={newShift.name}
                  onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                  placeholder="e.g. Late Evening"
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Start</label>
                <input
                  type="time"
                  value={newShift.start_time}
                  onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium">End</label>
                <input
                  type="time"
                  value={newShift.end_time}
                  onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button onClick={addShift} className="h-9 w-full rounded-md bg-primary text-primary-foreground text-sm font-medium">
                  Add shift
                </button>
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
                    <button onClick={() => removeShift(s.id)} className="h-8 px-3 text-xs text-destructive hover:bg-secondary rounded-md font-medium">
                      Remove
                    </button>
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
              {people.map((p: any) => {
                const rec = attendanceBy[p.id];
                const ros = rosterBy[p.id];
                const shift = shifts.find((s) => s.id === (rec?.shift_id ?? ros?.shift_id));
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{p.full_name || p.email}</td>
                    <td className="px-4 py-3">
                      {tab === "roster" && isAdmin ? (
                        <select
                          className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                          value={ros?.shift_id ?? ""}
                          onChange={(e) => assignShift(p.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {shifts.map((s: any) => (
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
                              className="rounded-md border border-input bg-card px-2 py-1 text-sm"
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
