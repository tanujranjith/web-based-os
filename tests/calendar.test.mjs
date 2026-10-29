import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKey,
  parseDate,
  monthDays,
  eventsForDay,
  normalizeEvent,
} from "../src/core/calendar.js";
test("month grid starts on Monday and has six complete weeks", () => {
  const days = monthDays(2026, 8);
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(dateKey(days[0]), "2026-08-31");
  assert.equal(dateKey(days[41]), "2026-10-11");
});
test("date parsing handles leap years and rejects rollover dates", () => {
  assert.ok(parseDate("2024-02-29"));
  assert.equal(parseDate("2025-02-29"), null);
  assert.equal(parseDate("2026-13-01"), null);
  assert.equal(parseDate("not-a-date"), null);
});
test("daily events sort all-day first without mutating stored order", () => {
  const events = [
    { date: "2026-09-07", time: "14:00", title: "Later" },
    { date: "2026-09-07", time: "", title: "All day" },
    { date: "2026-09-08", time: "09:00", title: "Tomorrow" },
  ];
  assert.deepEqual(
    eventsForDay(events, "2026-09-07").map((e) => e.title),
    ["All day", "Later"],
  );
  assert.equal(events[0].title, "Later");
});
test("event validation trims text and rejects invalid title, date and time", () => {
  assert.equal(
    normalizeEvent({ title: " Test ", date: "2026-09-07", category: "bad" })
      .title,
    "Test",
  );
  for (const input of [
    { title: " ", date: "2026-09-07" },
    { title: "Test", date: "2026-02-30" },
    { title: "Test", date: "2026-09-07", time: "25:00" },
  ])
    assert.throws(() => normalizeEvent(input));
});

test("weekly and monthly recurrence respects start/end dates", async () => {
  const { eventsForDay } = await import("../src/core/calendar.js");
  const event = {
    title: "Standup",
    date: "2026-10-28",
    repeat: "weekly",
    until: "2026-11-11",
  };
  assert.equal(eventsForDay([event], "2026-11-04").length, 1);
  assert.equal(eventsForDay([event], "2026-11-05").length, 0);
  assert.equal(eventsForDay([event], "2026-11-18").length, 0);
  assert.equal(
    eventsForDay(
      [{ ...event, date: "2026-01-31", repeat: "monthly", until: "" }],
      "2026-02-28",
    ).length,
    0,
  );
});
