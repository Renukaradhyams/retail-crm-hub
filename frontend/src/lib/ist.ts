/** IST (UTC+05:30) date helpers. All CRM dates are anchored to store-local time. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** ISO yyyy-mm-dd for the current IST day (matches the `date` columns). */
export function istToday(): string {
  return istNow().toISOString().slice(0, 10);
}

export function istHour(): number {
  return istNow().getUTCHours();
}

/** Display format DD/MM/YYYY. */
export function formatDMY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

export function slotLabel(hour: number): string {
  return `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`;
}

export function slotRange(openHour = 10, closeHour = 22): number[] {
  const slots: number[] = [];
  for (let h = openHour; h < closeHour; h++) slots.push(h);
  return slots;
}

export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
