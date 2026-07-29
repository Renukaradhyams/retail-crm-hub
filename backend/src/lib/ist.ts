/** IST (UTC+05:30) date helpers — shared between backend and frontend */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export function istToday(): string {
  return istNow().toISOString().slice(0, 10);
}

export function istHour(): number {
  return istNow().getUTCHours();
}
