const KST_TIME_ZONE = "Asia/Seoul";
export const KST_OFFSET = "+09:00";

const kstWallClockFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const kstDateTimeDisplayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

interface KstWallClock {
  year: string;
  calendarDate: string;
  clockTime: string;
}

function readKstWallClock(at: Date): KstWallClock {
  const parts = kstWallClockFormat.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "00";
  return {
    year: part("year"),
    calendarDate: `${part("year")}-${part("month")}-${part("day")}`,
    clockTime: `${part("hour")}:${part("minute")}:${part("second")}`,
  };
}

function kstIso(calendarDate: string, clockTime: string): string {
  return `${calendarDate}T${clockTime}${KST_OFFSET}`;
}

export function nowKstIso(now: Date = new Date()): string {
  const { calendarDate, clockTime } = readKstWallClock(now);
  return kstIso(calendarDate, clockTime);
}

export function kstIsoOn(calendarDate: string, now: Date = new Date()): string {
  return kstIso(calendarDate, readKstWallClock(now).clockTime);
}

export function kstDate(at: Date = new Date()): string {
  return readKstWallClock(at).calendarDate;
}

export function kstYear(iso: string): string {
  return readKstWallClock(new Date(iso)).year;
}

export function kstDateTime(iso: string): string {
  return kstDateTimeDisplayFormat.format(new Date(iso));
}
