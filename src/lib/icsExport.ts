import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";

export function generateICS(event: DateBasedEvent | TimeBasedEvent): string {
  const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
  const start = event.tags.find((tag) => tag[0] === "start")?.[1];
  const end = event.tags.find((tag) => tag[0] === "end")?.[1];
  const location = event.tags.find((tag) => tag[0] === "location")?.[1];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nostr Event//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DESCRIPTION:${event.content}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `LOCATION:${location || ""}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return ics;
}

export function downloadICS(event: DateBasedEvent | TimeBasedEvent) {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${
    event.tags.find((tag) => tag[0] === "title")?.[1] || "event"
  }.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
