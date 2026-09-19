import assert from "node:assert/strict";
import test from "node:test";
import { calendarDateOf, kstDate, kstDateTime, kstIsoOn, kstYear, nowKstIso } from "./dates.ts";

test("server and browser dates roll over together at midnight in Seoul", () => {
  const before = new Date("2025-12-31T14:59:59Z");
  const after = new Date("2025-12-31T15:00:00Z");
  assert.equal(nowKstIso(before), "2025-12-31T23:59:59+09:00");
  assert.equal(nowKstIso(after), "2026-01-01T00:00:00+09:00");
  assert.equal(kstDate(before), "2025-12-31");
  assert.equal(kstDate(after), "2026-01-01");
  assert.equal(kstYear(after.toISOString()), "2026");
});

test("backdating changes the day while retaining the Seoul wall clock", () => {
  assert.equal(
    kstIsoOn("2024-02-29", new Date("2026-09-08T01:23:45Z")),
    "2024-02-29T10:23:45+09:00",
  );
});

test("the post list shows publication times on the Seoul calendar", () => {
  assert.match(kstDateTime("2025-12-31T14:59:00Z"), /^2025\. 12\. 31\. /);
  assert.match(kstDateTime("2025-12-31T15:00:00Z"), /^2026\. 1\. 1\. /);
});

test("the calendar date of a timestamp is read as written, without converting its offset", () => {
  assert.equal(calendarDateOf("2026-01-01T00:30:00+09:00"), "2026-01-01");
  assert.equal(calendarDateOf("2026-01-01"), "2026-01-01");
});
