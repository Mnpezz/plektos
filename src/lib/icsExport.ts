import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";

function formatDateForICS(dateStr: string, isTimeBasedEvent: boolean): string {
  if (isTimeBasedEvent) {
    // Handle Unix timestamps (seconds)
    let timestamp: number;
    if (dateStr.match(/^\d{10}$/)) {
      // 10-digit Unix timestamp (seconds)
      timestamp = parseInt(dateStr) * 1000;
    } else if (dateStr.match(/^\d{13}$/)) {
      // 13-digit Unix timestamp (milliseconds)
      timestamp = parseInt(dateStr);
    } else {
      throw new Error(`Invalid timestamp format: ${dateStr}`);
    }
    
    const date = new Date(timestamp);
    // Format as UTC datetime: YYYYMMDDTHHMMSSZ
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  } else {
    // Handle ISO 8601 date format (YYYY-MM-DD) for all-day events
    const date = new Date(dateStr + 'T00:00:00Z');
    // Format as date only: YYYYMMDD
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
}

export function generateICS(event: DateBasedEvent | TimeBasedEvent): string {
  const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
  const startTag = event.tags.find((tag) => tag[0] === "start")?.[1];
  const endTag = event.tags.find((tag) => tag[0] === "end")?.[1];
  const location = event.tags.find((tag) => tag[0] === "location")?.[1];
  
  if (!startTag) {
    throw new Error("Event must have a start time");
  }

  const isTimeBasedEvent = event.kind === 31923;
  
  // Format dates according to ICS specification
  const dtstart = formatDateForICS(startTag, isTimeBasedEvent);
  const dtend = endTag ? formatDateForICS(endTag, isTimeBasedEvent) : dtstart;
  
  // Add VALUE parameter for all-day events
  const startProperty = isTimeBasedEvent ? `DTSTART:${dtstart}` : `DTSTART;VALUE=DATE:${dtstart}`;
  const endProperty = isTimeBasedEvent ? `DTEND:${dtend}` : `DTEND;VALUE=DATE:${dtend}`;
  
  // Generate a unique identifier for the event
  const uid = `${event.id}@nostr-event`;
  
  // Get current timestamp in ICS format for DTSTAMP
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nostr Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    startProperty,
    endProperty,
    `SUMMARY:${title}`,
    `DESCRIPTION:${event.content.replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${location}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(line => line !== "").join("\r\n");

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
