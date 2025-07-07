import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import type { NostrFilter } from "@jsr/nostrify__types";
import type { DateBasedEvent, TimeBasedEvent, EventRSVP } from "./eventTypes";
import { cacheEvent } from "./indexedDB";
import { nip19 } from "nostr-tools";

export function useEvents(options?: {
  timeRange?: { start: number; end: number };
  limit?: number;
  includeRSVPs?: boolean;
}) {
  const { nostr } = useNostr();
  const { timeRange, limit = 100, includeRSVPs = true } = options || {};

  return useQuery({
    queryKey: ["events", timeRange, limit, includeRSVPs],
    queryFn: async (c) => {
      console.log("Fetching events...");
      console.log("Nostr instance:", nostr);
      console.log("Options:", { timeRange, limit, includeRSVPs });

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]); // Increased timeout for larger queries
      try {
        // Build filters based on options
        const filters: NostrFilter[] = [];
        
        // Main calendar events filter
        const calendarFilter: NostrFilter = {
          kinds: [31922, 31923],
          limit,
        };
        
        // Add time-based filtering if specified
        if (timeRange) {
          // For time-based events, we can filter by timestamp directly
          // For date-based events, this is trickier since they might use YYYY-MM-DD format
          // We'll use a broader range and filter client-side for date events
          calendarFilter.since = Math.floor(timeRange.start / 1000) - (30 * 24 * 60 * 60); // 30 days buffer
          calendarFilter.until = Math.floor(timeRange.end / 1000) + (30 * 24 * 60 * 60); // 30 days buffer
        }
        
        filters.push(calendarFilter);
        
        // RSVP events filter (if requested)
        if (includeRSVPs) {
          const rsvpFilter: NostrFilter = {
            kinds: [31925],
            limit: Math.floor(limit / 2), // Use half the limit for RSVPs
          };
          
          if (timeRange) {
            rsvpFilter.since = Math.floor(timeRange.start / 1000) - (30 * 24 * 60 * 60);
            rsvpFilter.until = Math.floor(timeRange.end / 1000) + (30 * 24 * 60 * 60);
          }
          
          filters.push(rsvpFilter);
        }

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
              console.warn(`Skipping event ${event.id} - missing d tag`);
              return acc;
            }
            
            // Filter out private booking events
            if (dTag.includes('booking-')) {
              console.debug(`Filtering out private booking event: ${dTag}`);
              return acc;
            }
            
            // Create a coordinate identifier for this replaceable event
            const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
            
            const existingEvent = acc.find(e => {
              if (e.kind !== event.kind || e.pubkey !== event.pubkey) return false;
              const existingDTag = e.tags.find(tag => tag[0] === 'd')?.[1];
              return existingDTag === dTag;
            });

            if (!existingEvent) {
              // First time seeing this coordinate, add the event
              console.debug(`Adding new event for coordinate: ${coordinate}`);
              acc.push(event);
            } else if (event.created_at > existingEvent.created_at) {
              // This is a newer version, replace the existing one
              console.debug(`Replacing older event for coordinate: ${coordinate} (${existingEvent.created_at} -> ${event.created_at})`);
              const index = acc.indexOf(existingEvent);
              acc[index] = event;
            } else {
              console.debug(`Skipping older event for coordinate: ${coordinate} (${event.created_at} vs ${existingEvent.created_at})`);
            }
            // If existing is newer, keep it and skip this one
            return acc;
          }

          // For any other event types, just add them
          acc.push(event);
          return acc;
        }, [] as (DateBasedEvent | TimeBasedEvent | EventRSVP)[]);

        console.log("Deduplicated events:", deduplicated.length, "events");
        
        // Debug: Check for any remaining duplicates after deduplication
        const coordinateMap = new Map<string, number>();
        deduplicated.forEach(event => {
          if (event.kind === 31922 || event.kind === 31923) {
            const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
            if (dTag) {
              const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
              const count = coordinateMap.get(coordinate) || 0;
              coordinateMap.set(coordinate, count + 1);
            }
          }
        });
        
        const duplicateCoordinates = Array.from(coordinateMap.entries()).filter(([_, count]) => count > 1);
        if (duplicateCoordinates.length > 0) {
          console.error("🚨 DEDUPLICATION FAILED! Still have duplicates:", duplicateCoordinates);
          console.error("Events with duplicates:", deduplicated.filter(event => {
            if (event.kind === 31922 || event.kind === 31923) {
              const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
              if (dTag) {
                const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
                return coordinateMap.get(coordinate)! > 1;
              }
            }
            return false;
          }));
        }

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

// Note: useInfiniteEvents was removed in favor of client-side pagination
// The infinite scrolling approach doesn't work well with Nostr's architecture
// for calendar events due to the sparse nature of the data and lack of reliable
// server-side pagination. Instead, we use useEvents with a higher limit and
// implement client-side "Load More" functionality.

// Hook specifically optimized for calendar views
export function useCalendarEvents(currentMonth: Date) {
  // Calculate time range for 3 months (previous, current, next)
  const startOfRange = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const endOfRange = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0, 23, 59, 59, 999);
  
  return useEvents({
    timeRange: {
      start: startOfRange.getTime(),
      end: endOfRange.getTime(),
    },
    limit: 500, // Higher limit for calendar view
    includeRSVPs: true,
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
