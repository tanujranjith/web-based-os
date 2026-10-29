export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return dateKey(date) === key ? date : null;
}

export function monthDays(year, month) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  return Array.from(
    { length: 42 },
    (_, index) => new Date(year, month, index - offset + 1, 12),
  );
}

export function eventsForDay(events, day) {
  return events
    .filter((event) => occursOn(event, day))
    .slice()
    .sort(
      (a, b) =>
        (a.time || "").localeCompare(b.time || "") ||
        a.title.localeCompare(b.title),
    );
}

export function normalizeEvent(input) {
  const title = String(input.title || "")
    .trim()
    .slice(0, 160);
  if (!title) throw new Error("Give your event a title.");
  if (!parseDate(input.date)) throw new Error("Choose a valid date.");
  const time = input.time || "";
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Choose a valid time.");
  const repeat = ["daily", "weekly", "monthly"].includes(input.repeat)
    ? input.repeat
    : "";
  const until = input.until || "";
  if (until && (!parseDate(until) || until < input.date))
    throw new Error("Repeat end must be on or after the event date.");
  return {
    title,
    date: input.date,
    time,
    repeat,
    until,
    category: ["personal", "work", "important"].includes(input.category)
      ? input.category
      : "personal",
    details: String(input.details || "")
      .trim()
      .slice(0, 2000),
  };
}

export function occursOn(event, day) {
  if (event.date === day) return true;
  if (!event.repeat || day < event.date || (event.until && day > event.until))
    return false;
  const start = parseDate(event.date),
    date = parseDate(day);
  if (!start || !date) return false;
  if (event.repeat === "daily") return true;
  if (event.repeat === "weekly") return start.getDay() === date.getDay();
  if (event.repeat === "monthly") return start.getDate() === date.getDate();
  return false;
}
