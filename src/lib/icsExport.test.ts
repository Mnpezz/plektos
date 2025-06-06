import { describe, it, expect } from "vitest";
import { generateICS } from "./icsExport";
import type { DateBasedEvent, TimeBasedEvent, BaseEvent } from "./eventTypes";

describe("ICS Export", () => {
  it("should generate correct ICS for time-based events with Unix timestamps", () => {
    const timeBasedEvent: TimeBasedEvent = {
      id: "test123",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "This is a test event",
      tags: [
        ["d", "unique-id"],
        ["title", "Test Time Event"],
        ["start", "1714924800"], // May 5, 2024 16:00:00 UTC
        ["end", "1714928400"], // May 5, 2024 17:00:00 UTC
        ["location", "Test Location"],
      ],
    };

    const ics = generateICS(timeBasedEvent);
    
    expect(ics).toContain("DTSTART:20240505T160000Z");
    expect(ics).toContain("DTEND:20240505T170000Z");
    expect(ics).toContain("SUMMARY:Test Time Event");
    expect(ics).toContain("DESCRIPTION:This is a test event");
    expect(ics).toContain("LOCATION:Test Location");
    expect(ics).toContain("UID:test123@nostr-event");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");

    // Should NOT contain VALUE=DATE for time-based events
    expect(ics).not.toContain("VALUE=DATE");
  });

  it("should generate correct ICS for date-based events with ISO dates", () => {
    const dateBasedEvent: DateBasedEvent = {
      id: "test456",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31922,
      content: "This is a test all-day event",
      tags: [
        ["d", "unique-id"],
        ["title", "Test Date Event"],
        ["start", "2024-05-05"],
        ["end", "2024-05-06"],
        ["location", "Test Location"],
      ],
    };

    const ics = generateICS(dateBasedEvent);
    
    expect(ics).toContain("DTSTART;VALUE=DATE:20240505");
    expect(ics).toContain("DTEND;VALUE=DATE:20240506");
    expect(ics).toContain("SUMMARY:Test Date Event");
    expect(ics).toContain("DESCRIPTION:This is a test all-day event");
    expect(ics).toContain("LOCATION:Test Location");
    expect(ics).toContain("UID:test456@nostr-event");
  });

  it("should handle events without end time", () => {
    const event: BaseEvent & { kind: 31923 } = {
      id: "test789",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Event without end time",
      tags: [
        ["d", "unique-id"],
        ["title", "No End Time"],
        ["start", "1714924800"],
      ],
    };

    const ics = generateICS(event as TimeBasedEvent);
    
    expect(ics).toContain("DTSTART:20240505T160000Z");
    expect(ics).toContain("DTEND:20240505T160000Z"); // Should use start time for end
  });

  it("should handle events without location", () => {
    const event: TimeBasedEvent = {
      id: "test101",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Event without location",
      tags: [
        ["d", "unique-id"],
        ["title", "No Location"],
        ["start", "1714924800"],
        ["end", "1714928400"],
      ],
    };

    const ics = generateICS(event);
    
    expect(ics).not.toContain("LOCATION:");
  });

  it("should escape newlines in description", () => {
    const event: TimeBasedEvent = {
      id: "test102",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Line 1\nLine 2\nLine 3",
      tags: [
        ["d", "unique-id"],
        ["title", "Multiline Event"],
        ["start", "1714924800"],
        ["end", "1714928400"],
      ],
    };

    const ics = generateICS(event);
    
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2\\nLine 3");
  });

  it("should handle 13-digit timestamps (milliseconds)", () => {
    const event: TimeBasedEvent = {
      id: "test103",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Event with millisecond timestamp",
      tags: [
        ["d", "unique-id"],
        ["title", "Millisecond Timestamp"],
        ["start", "1714924800000"], // 13-digit timestamp
        ["end", "1714928400000"],
      ],
    };

    const ics = generateICS(event);
    
    expect(ics).toContain("DTSTART:20240505T160000Z");
    expect(ics).toContain("DTEND:20240505T170000Z");
  });

  it("should throw error for missing start time", () => {
    const event: BaseEvent & { kind: 31923 } = {
      id: "test104",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Event without start",
      tags: [
        ["d", "unique-id"],
        ["title", "No Start Time"],
      ],
    };

    expect(() => generateICS(event as TimeBasedEvent)).toThrow("Event must have a start time");
  });

  it("should throw error for invalid timestamp format", () => {
    const event: BaseEvent & { kind: 31923 } = {
      id: "test105",
      pubkey: "testpubkey",
      created_at: 1714924800,
      kind: 31923,
      content: "Event with invalid timestamp",
      tags: [
        ["d", "unique-id"],
        ["title", "Invalid Timestamp"],
        ["start", "invalid-timestamp"],
      ],
    };

    expect(() => generateICS(event as TimeBasedEvent)).toThrow("Invalid timestamp format");
  });
});