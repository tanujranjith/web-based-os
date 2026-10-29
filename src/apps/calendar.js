import { store } from "../core/state.js";
import { bus } from "../core/event-bus.js";
import {
  dateKey,
  parseDate,
  monthDays,
  eventsForDay,
  normalizeEvent,
} from "../core/calendar.js";
import { updateTask } from "../core/tasks.js";
import { escape } from "../ui/icons.js";
export default {
  id: "calendar",
  name: "Calendar",
  category: "Productivity",
  keywords: ["agenda", "events", "schedule"],
  defaultSize: { w: 1120, h: 740 },
  mount(container, ctx) {
    let selected = dateKey(),
      month = new Date(),
      mode = "month",
      editing = null;
    const el = document.createElement("div");
    el.className = "app calendar-v4";
    el.innerHTML = `<header class="calendar-toolbar"><div><small>MAKE ROOM FOR YOUR DAY</small><h1></h1></div><div><button class="btn" data-nav="-1" aria-label="Previous period">‹</button><button class="btn" data-today>Today</button><button class="btn" data-nav="1" aria-label="Next period">›</button><select class="select" aria-label="Calendar view"><option value="month">Month</option><option value="week">Week</option><option value="agenda">Agenda</option></select><button class="btn primary" data-new>New event</button></div></header><div class="calendar-layout"><section class="calendar-month"><div class="calendar-weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<span>${x}</span>`).join("")}</div><div class="calendar-grid"></div></section><aside class="calendar-agenda scroll-thin"><h2></h2><div class="calendar-events"></div><form class="event-form" hidden><h3>Event details</h3><label>Title<input class="input" name="title" required maxlength="160"></label><div class="row"><label>Date<input class="input" type="date" name="date" required></label><label>Time<input class="input" type="time" name="time"></label></div><label>Calendar<select class="select" name="category"><option value="personal">Personal</option><option value="work">Work</option><option value="important">Important</option></select></label><label>Repeat<select class="select" name="repeat"><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Repeat until (optional)<input class="input" type="date" name="until"></label><label>Details<textarea class="input" name="details"></textarea></label><p role="alert"></p><div class="row"><button class="btn" type="button" data-cancel>Cancel</button><button class="btn primary">Save event</button></div></form></aside></div>`;
    container.append(el);
    const form = el.querySelector("form");
    const events = () => [
      ...(store.get().events || []),
      ...store
        .get()
        .tasks.filter((t) => t.when && !t.done)
        .map((t) => ({
          id: "task:" + t.id,
          title: t.text,
          date: t.when,
          time: "",
          category: "work",
          taskId: t.id,
          details: t.project || "",
        })),
    ];
    function dates() {
      if (mode === "month")
        return monthDays(month.getFullYear(), month.getMonth());
      const d = parseDate(selected);
      if (mode === "week") {
        const offset = (d.getDay() + 6) % 7;
        return Array.from(
          { length: 7 },
          (_, i) =>
            new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate() - offset + i,
              12,
            ),
        );
      }
      return Array.from(
        { length: 30 },
        (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, 12),
      );
    }
    function render() {
      el.querySelector("h1").textContent =
        mode === "month"
          ? month.toLocaleDateString([], { month: "long", year: "numeric" })
          : parseDate(selected).toLocaleDateString([], {
              month: "long",
              day: "numeric",
              year: "numeric",
            });
      const grid = el.querySelector(".calendar-grid");
      grid.className = "calendar-grid " + mode;
      el.querySelector(".calendar-weekdays").hidden = mode === "agenda";
      grid.innerHTML =
        dates()
          .map((d) => {
            const key = dateKey(d),
              items = eventsForDay(events(), key);
            if (mode === "agenda" && !items.length) return "";
            return `<section class="calendar-day ${d.getMonth() !== month.getMonth() ? "outside" : ""} ${key === dateKey() ? "today" : ""} ${key === selected ? "selected" : ""}" data-date="${key}" tabindex="0" role="button" aria-label="${escape(d.toLocaleDateString())}"><span class="day-number">${mode === "agenda" ? escape(d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })) : d.getDate()}</span><div class="day-event-list">${items
              .slice(0, mode === "month" ? 3 : 20)
              .map(
                (e) =>
                  `<button draggable="true" data-event="${escape(e.id)}" class="day-event ${e.category}" title="${escape(e.title)}">${e.taskId ? "☐ " : e.time ? escape(e.time) + " " : ""}${escape(e.title)}</button>`,
              )
              .join("")}</div></section>`;
          })
          .join("") ||
        '<p class="app-empty">Nothing scheduled for this period.</p>';
      grid.querySelectorAll("[data-date]").forEach((b) => {
        b.onclick = (e) => {
          if (e.target.closest("[data-event]")) return;
          selected = b.dataset.date;
          render();
          ctx.checkpoint?.();
        };
        b.onkeydown = (e) => {
          if (e.key === "Enter") {
            selected = b.dataset.date;
            render();
            ctx.checkpoint?.();
          }
        };
        b.ondragover = (e) => e.preventDefault();
        b.ondrop = (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/nova-event"),
            date = b.dataset.date;
          if (id.startsWith("task:")) updateTask(id.slice(5), { when: date });
          else
            store.update((s) => {
              const event = s.events.find((x) => x.id === id);
              if (event) event.date = date;
            });
        };
      });
      grid.querySelectorAll("[data-event]").forEach((b) => {
        b.onclick = () => editId(b.dataset.event);
        b.ondragstart = (e) =>
          e.dataTransfer.setData("text/nova-event", b.dataset.event);
      });
      el.querySelector(".calendar-agenda h2").textContent = parseDate(
        selected,
      ).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      el.querySelector(".calendar-events").innerHTML =
        eventsForDay(events(), selected)
          .map(
            (e) =>
              `<article class="agenda-event ${e.category}"><small>${e.taskId ? "TASK" : e.time || "ALL DAY"}${e.repeat ? " · Repeats " + e.repeat : ""}</small><button data-edit="${escape(e.id)}">${escape(e.title)}</button><p>${escape(e.details || "")}</p>${!e.taskId ? `<button class="event-delete" data-delete="${escape(e.id)}" aria-label="Delete event">×</button>` : ""}</article>`,
          )
          .join("") || '<p class="calendar-empty">Nothing scheduled.</p>';
      el.querySelectorAll("[data-edit]").forEach(
        (b) => (b.onclick = () => editId(b.dataset.edit)),
      );
      el.querySelectorAll("[data-delete]").forEach(
        (b) =>
          (b.onclick = () => {
            if (confirm("Delete this event and its repeating occurrences?"))
              store.update(
                (s) =>
                  (s.events = s.events.filter(
                    (e) => e.id !== b.dataset.delete,
                  )),
              );
          }),
      );
    }
    function editId(id) {
      if (id.startsWith("task:"))
        return ctx.openApp("tasks", { taskId: id.slice(5) });
      edit(store.get().events.find((e) => e.id === id));
    }
    function edit(event) {
      editing = event?.id || null;
      form.reset();
      for (const field of [
        "title",
        "date",
        "time",
        "category",
        "repeat",
        "until",
        "details",
      ])
        form.elements[field].value =
          event?.[field] ||
          (field === "date"
            ? selected
            : field === "category"
              ? "personal"
              : "");
      form.hidden = false;
      form.elements.title.focus();
      form.querySelector("[role=alert]").textContent = "";
    }
    el.querySelector("select[aria-label]").onchange = (e) => {
      mode = e.target.value;
      render();
    };
    el.querySelectorAll("[data-nav]").forEach(
      (b) =>
        (b.onclick = () => {
          const d = parseDate(selected),
            n = +b.dataset.nav;
          if (mode === "month") {
            month = new Date(month.getFullYear(), month.getMonth() + n, 1, 12);
            selected = dateKey(month);
          } else {
            d.setDate(d.getDate() + n * (mode === "week" ? 7 : 30));
            selected = dateKey(d);
            month = d;
          }
          render();
        }),
    );
    el.querySelector("[data-today]").onclick = () => {
      selected = dateKey();
      month = new Date();
      render();
    };
    el.querySelector("[data-new]").onclick = () => edit();
    el.querySelector("[data-cancel]").onclick = () => (form.hidden = true);
    form.onsubmit = (e) => {
      e.preventDefault();
      try {
        const entry = normalizeEvent(Object.fromEntries(new FormData(form)));
        store.update((s) => {
          const old = s.events.find((x) => x.id === editing);
          if (old) Object.assign(old, entry);
          else s.events.push({ id: crypto.randomUUID(), ...entry });
        });
        selected = entry.date;
        month = parseDate(selected);
        form.hidden = true;
        render();
      } catch (error) {
        form.querySelector("[role=alert]").textContent = error.message;
      }
    };
    const off = bus.on("state-change", render),
      onOpen = (opts) => {
        if (parseDate(opts?.date)) {
          selected = opts.date;
          month = parseDate(selected);
        }
        render();
        if (opts?.newEvent) edit();
      };
    onOpen(ctx.opts);
    return {
      onOpen,
      session: () => ({ date: selected }),
      unmount() {
        off();
        el.remove();
      },
    };
  },
};
