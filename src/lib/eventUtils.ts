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

        // For replaceable events (31922, 31923), only keep the latest version of each coordinate
        const deduplicated = typedEvents.reduce((acc, event) => {
          // For RSVP events (31925), keep all of them as they're not replaceable per se
          if (event.kind === 31925) {
            acc.push(event);
            return acc;
          }

          // For replaceable calendar events (31922, 31923)
          if (event.kind === 31922 || event.kind === 31923) {
            const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
            if (!dTag) {
              // Skip events without d tag
              return acc;
            }
            const existingEvent = acc.find(e => {
              if (e.kind !== event.kind || e.pubkey !== event.pubkey) return false;
              const existingDTag = e.tags.find(tag => tag[0] === 'd')?.[1];
              return existingDTag === dTag;
            });

            if (!existingEvent) {
              // First time seeing this coordinate, add the event
              acc.push(event);
            } else if (event.created_at > existingEvent.created_at) {
              // This is a newer version, replace the existing one
              const index = acc.indexOf(existingEvent);
              acc[index] = event;
            }
            // If existing is newer, keep it and skip this one
            return acc;
          }

          // For any other event types, just add them
          acc.push(event);
          return acc;
        }, [] as (DateBasedEvent | TimeBasedEvent | EventRSVP)[]);

        console.log("Deduplicated events:", deduplicated.length, "events");

        // Cache events in IndexedDB
        for (const event of deduplicated) {
          await cacheEvent(event);
        }

        return deduplicated;
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
