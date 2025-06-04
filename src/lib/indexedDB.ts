import Dexie, { Table } from "dexie";
import type { DateBasedEvent, TimeBasedEvent, EventRSVP } from "./eventTypes";

class EventDatabase extends Dexie {
  events!: Table<DateBasedEvent | TimeBasedEvent>;
  rsvps!: Table<EventRSVP>;

  constructor() {
    super("EventDatabase");
    (this as Dexie).version(1).stores({
      events: "id, pubkey, created_at, kind",
      rsvps: "id, pubkey, created_at, kind",
    });
  }
}

export const db = new EventDatabase();

export async function cacheEvent(
  event: DateBasedEvent | TimeBasedEvent | EventRSVP
) {
  if (event.kind === 31925) {
    await db.rsvps.put(event as EventRSVP);
  } else {
    await db.events.put(event as DateBasedEvent | TimeBasedEvent);
  }
}

export async function getCachedEvents() {
  return await db.events.toArray();
}

export async function getCachedRSVPs() {
  return await db.rsvps.toArray();
}
