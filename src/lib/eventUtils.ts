import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { DateBasedEvent, TimeBasedEvent, EventRSVP } from "./eventTypes";
import { cacheEvent } from "./indexedDB";

export function useEvents() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["events"],
    queryFn: async (c) => {
      console.log("Fetching events...");
      console.log("Nostr instance:", nostr);

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]); // Increased timeout
      try {
        // Query for both kinds of events with more specific parameters
        const filters = [
          {
            kinds: [31922, 31923],
            limit: 100,
          },
          {
            kinds: [31925], // RSVP events
            limit: 100,
          },
        ];
        console.log("Querying with filters:", JSON.stringify(filters, null, 2));

        const events = await nostr.query(filters, { signal });
        console.log("Raw events from query:", events);

        if (!events || events.length === 0) {
          console.log("No events returned from query");
          return [];
        }

        const typedEvents = events as unknown as (
          | DateBasedEvent
          | TimeBasedEvent
          | EventRSVP
        )[];

        console.log(
          "Typed events:",
          typedEvents.map((e) => ({
            id: e.id,
            kind: e.kind,
            pubkey: e.pubkey,
            created_at: e.created_at,
            tags: e.tags,
          }))
        );

        // Cache events in IndexedDB
        for (const event of typedEvents) {
          await cacheEvent(event);
        }

        return typedEvents;
      } catch (error) {
        console.error("Error fetching events:", error);
        throw error;
      }
    },
    initialData: [],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
