export function nowKstIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const at = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return (
    `${at("year")}-${at("month")}-${at("day")}` +
    `T${at("hour")}:${at("minute")}:${at("second")}+09:00`
  );
}

export function kstIsoOn(day: string, now: Date = new Date()): string {
  return day + nowKstIso(now).slice(10);
}

export function kstDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function kstYear(iso: string): string {
  return kstDate(new Date(iso)).slice(0, 4);
}

export function kstDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
