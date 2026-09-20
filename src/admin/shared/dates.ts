const KST_TIME_ZONE = "Asia/Seoul";
const KST_OFFSET = "+09:00";

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

const ISO_DATE_AND_MINUTES = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/;
const ISO_SECONDS = /T\d{2}:\d{2}(:\d{2})/;

export function datetimeLocalValue(iso: string): string {
  const match = ISO_DATE_AND_MINUTES.exec(iso);
  return match === null ? "" : `${match[1]}T${match[2]}`;
}

export function kstIsoFromDatetimeLocal(value: string, previousIso: string): string {
  if (value === "") return previousIso;
  const seconds = ISO_SECONDS.exec(previousIso)?.[1] ?? ":00";
  return `${value}${seconds}${KST_OFFSET}`;
}

export function nowKstIso(now: Date = new Date()): string {
  const { calendarDate, clockTime } = readKstWallClock(now);
  return kstIso(calendarDate, clockTime);
}

export function kstIsoOn(calendarDate: string, now: Date = new Date()): string {
  return kstIso(calendarDate, readKstWallClock(now).clockTime);
}

const CALENDAR_DATE_SHAPE = /^20\d\d-\d\d-\d\d$/;

export function looksLikeCalendarDate(value: string): boolean {
  return CALENDAR_DATE_SHAPE.test(value);
}

export function isCalendarDate(value: string): boolean {
  if (!looksLikeCalendarDate(value)) return false;
  const midnightUtc = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(midnightUtc) && new Date(midnightUtc).toISOString().slice(0, 10) === value;
}

export function calendarDateOf(iso: string): string {
  return iso.split("T")[0] ?? "";
}

export function yearAndMonthOf(calendarDate: string): { year: string; month: string } {
  return { year: calendarDate.slice(0, 4), month: calendarDate.slice(5, 7) };
}

export function kstDate(at: Date = new Date()): string {
  return readKstWallClock(at).calendarDate;
}

export function kstClockTime(at: Date = new Date()): string {
  return readKstWallClock(at).clockTime;
}

export function kstYear(iso: string): string {
  return readKstWallClock(new Date(iso)).year;
}

export function kstDateTime(iso: string): string {
  return kstDateTimeDisplayFormat.format(new Date(iso));
}
