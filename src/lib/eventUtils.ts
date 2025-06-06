import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { DateBasedEvent, TimeBasedEvent, EventRSVP } from "./eventTypes";
import { cacheEvent } from "./indexedDB";
import { nip19 } from "nostr-tools";

export function useEvents() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["events"],
    queryFn: async (c) => {
      console.log("Fetching events...");
      console.log("Nostr instance:", nostr);

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Reduced timeout for faster feedback
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
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

// Hook for loading a specific event by its identifier
export function useSingleEvent(eventIdentifier: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["event", eventIdentifier],
    queryFn: async (c) => {
      if (!eventIdentifier) {
        throw new Error("No event identifier provided");
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      try {
        // Try to decode the identifier to determine the query type
        const decoded = nip19.decode(eventIdentifier);
        
        if (decoded.type === 'naddr') {
          // For replaceable events, query by coordinate
          const { kind, pubkey, identifier } = decoded.data;
          const events = await nostr.query([{
            kinds: [kind],
            authors: [pubkey],
            "#d": [identifier],
            limit: 1
          }], { signal });
          
          return events[0] as unknown as DateBasedEvent | TimeBasedEvent || null;
        } else if (decoded.type === 'nevent' || decoded.type === 'note') {
          // For regular events, query by ID
          const eventId = decoded.type === 'note' ? decoded.data : decoded.data.id;
          const events = await nostr.query([{
            ids: [eventId],
            limit: 1
          }], { signal });
          
          return events[0] as unknown as DateBasedEvent | TimeBasedEvent || null;
        } else {
          // Try treating as raw hex ID
          const events = await nostr.query([{
            ids: [eventIdentifier],
            limit: 1
          }], { signal });
          
          return events[0] as unknown as DateBasedEvent | TimeBasedEvent || null;
        }
      } catch (error) {
        console.error("Error fetching single event:", error);
        // Try one more query with the raw identifier as a fallback
        try {
          const events = await nostr.query([{
            ids: [eventIdentifier],
            limit: 1
          }], { signal });
          
          return events[0] as unknown as DateBasedEvent | TimeBasedEvent || null;
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
          return null;
        }
      }
    },
    enabled: !!eventIdentifier,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
}
