import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDateOf,
  datetimeLocalValue,
  isCalendarDate,
  kstClockTime,
  kstDate,
  kstDateTime,
  kstIsoFromDatetimeLocal,
  kstIsoOn,
  kstYear,
  looksLikeCalendarDate,
  nowKstIso,
  yearAndMonthOf,
} from "./dates.ts";

test("server and browser dates roll over together at midnight in Seoul", () => {
  const before = new Date("2025-12-31T14:59:59Z");
  const after = new Date("2025-12-31T15:00:00Z");
  assert.equal(nowKstIso(before), "2025-12-31T23:59:59+09:00");
  assert.equal(nowKstIso(after), "2026-01-01T00:00:00+09:00");
  assert.equal(kstDate(before), "2025-12-31");
  assert.equal(kstDate(after), "2026-01-01");
  assert.equal(kstYear(after.toISOString()), "2026");
});

test("the Seoul wall clock is read in Asia/Seoul, not on whatever clock the machine keeps", () => {
  const machineTimeZone = process.env.TZ;
  try {
    for (const timeZone of ["UTC", "America/New_York", "Asia/Seoul"]) {
      process.env.TZ = timeZone;
      assert.equal(kstClockTime(new Date("2026-08-08T08:30:05+09:00")), "08:30:05", timeZone);
      assert.equal(kstDate(new Date("2026-08-08T08:30:05+09:00")), "2026-08-08", timeZone);
    }
  } finally {
    if (machineTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = machineTimeZone;
  }
});

test("backdating changes the day while retaining the Seoul wall clock", () => {
  assert.equal(
    kstIsoOn("2024-02-29", new Date("2026-09-08T01:23:45Z")),
    "2024-02-29T10:23:45+09:00",
  );
});

test("the post list shows publication times on the Seoul calendar", () => {
  assert.match(kstDateTime("2025-12-31T14:59:00Z") ?? "", /^2025\. 12\. 31\. /);
  assert.match(kstDateTime("2025-12-31T15:00:00Z") ?? "", /^2026\. 1\. 1\. /);
});

test("a timestamp that cannot be read has no Seoul year and no display time", () => {
  for (const unreadable of ["", "어제", "2026-03-01T10:00:00+09:00 # 메모"]) {
    assert.equal(kstYear(unreadable), null, unreadable);
    assert.equal(kstDateTime(unreadable), null, unreadable);
  }
});

test("the calendar date of a timestamp is read as written, without converting its offset", () => {
  assert.equal(calendarDateOf("2026-01-01T00:30:00+09:00"), "2026-01-01");
  assert.equal(calendarDateOf("2026-01-01"), "2026-01-01");
});

test("a calendar date names the year and month directory its post lives in", () => {
  assert.deepEqual(yearAndMonthOf("2026-02-03"), { year: "2026", month: "02" });
});

test("a date is a calendar date only when that day exists in 20xx", () => {
  for (const day of ["2024-02-29", "2026-12-31", "2000-01-01"]) {
    assert.equal(isCalendarDate(day), true, day);
  }
  for (const day of ["2023-02-29", "2026-02-31", "2026-13-01", "2026-00-10", "2026-2-3", "1999-12-31", "2026-02-03T00:00"]) {
    assert.equal(isCalendarDate(day), false, day);
  }
});

test("a date shaped like YYYY-MM-DD in 20xx looks like a calendar date even when that day does not exist", () => {
  for (const day of ["2026-02-31", "2026-13-01", "2024-02-29"]) assert.equal(looksLikeCalendarDate(day), true, day);
  for (const day of ["", "2026-2-3", "1999-12-31", "2026-02-03T00:00"]) assert.equal(looksLikeCalendarDate(day), false, day);
});

test("a datetime-local input shows the timestamp's date and minutes as written", () => {
  assert.equal(datetimeLocalValue("2026-08-07T23:05:11+09:00"), "2026-08-07T23:05");
  assert.equal(datetimeLocalValue("2026-08-07T23:05Z"), "2026-08-07T23:05");
  assert.equal(datetimeLocalValue("2026-08-07"), "");
});

test("a datetime-local edit becomes a Seoul timestamp that keeps the previous seconds", () => {
  assert.equal(kstIsoFromDatetimeLocal("2026-08-08T09:30", "2026-08-07T23:05:11+09:00"), "2026-08-08T09:30:11+09:00");
  assert.equal(kstIsoFromDatetimeLocal("2026-08-08T09:30", "2026-08-07T23:05Z"), "2026-08-08T09:30:00+09:00");
});

test("clearing the datetime-local input keeps the previous timestamp", () => {
  assert.equal(kstIsoFromDatetimeLocal("", "2026-08-07T23:05:11+09:00"), "2026-08-07T23:05:11+09:00");
});
