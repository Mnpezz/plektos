import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { DateBasedEvent, TimeBasedEvent, LiveEvent, RoomMeeting, InteractiveRoom, EventRSVP } from "@/lib/eventTypes";

interface UserRSVPWithEvent {
  rsvp: EventRSVP;
  event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom;
  status: string;
  eventTitle: string;
  eventDate: Date;
  eventStartTime?: string;
}

export type { UserRSVPWithEvent };

export function useUserRSVPs() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Fetch user's RSVP events (kind 31925)
  const { data: rsvps = [], isLoading: isLoadingRSVPs } = useQuery({
    queryKey: ["userRSVPs", user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return [];
      const events = await nostr.query(
        [{ kinds: [31925], authors: [user.pubkey] }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );
      return events as unknown as EventRSVP[];
    },
    enabled: !!user?.pubkey,
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch the actual events that were RSVP'd to
  const { data: rsvpEvents = [], isLoading: isLoadingRsvpEvents } = useQuery({
    queryKey: ["userRSVPEvents", rsvps],
    queryFn: async ({ signal }) => {
      if (!rsvps.length) return [];

      // Extract event IDs from e tags
      const eventIds = rsvps
        .map((rsvp) => rsvp.tags.find((tag) => tag[0] === "e")?.[1])
        .filter((id): id is string => id !== undefined);

      // Extract address coordinates from a tags and parse them
      const addressCoords = rsvps
        .map((rsvp) => rsvp.tags.find((tag) => tag[0] === "a")?.[1])
        .filter((addr): addr is string => addr !== undefined)
        .map((addr) => {
          const [kind, pubkey, identifier] = addr.split(':');
          return { kind: parseInt(kind), pubkey, identifier };
        })
        .filter(coord => coord.kind && coord.pubkey && coord.identifier);

      const filters: Array<{
        kinds: number[];
        ids?: string[];
        authors?: string[];
        '#d'?: string[];
      }> = [];

      // Query by event IDs if we have any
      if (eventIds.length > 0) {
        filters.push({
          kinds: [31922, 31923, 30311, 30312, 30313],
          ids: eventIds
        });
      }

      // Query by address coordinates for replaceable events
      for (const coord of addressCoords) {
        filters.push({
          kinds: [coord.kind],
          authors: [coord.pubkey],
          '#d': [coord.identifier]
        });
      }

      if (filters.length === 0) return [];

      const events = await nostr.query(
        filters,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );

      // Deduplicate events by ID (in case same event was fetched via multiple filters)
      const uniqueEvents = events.reduce((acc, event) => {
        if (!acc.find(e => e.id === event.id)) {
          acc.push(event);
        }
        return acc;
      }, [] as typeof events);

      return uniqueEvents as unknown as (DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom)[];
    },
    enabled: !!rsvps.length,
    retry: 1,
    staleTime: 30000,
  });

  const processedQuery = useQuery({
    queryKey: ["processedUserRSVPs", rsvps, rsvpEvents],
    queryFn: async (): Promise<{ upcoming: UserRSVPWithEvent[], past: UserRSVPWithEvent[] }> => {
      if (!rsvps.length || !rsvpEvents.length) {
        return { upcoming: [], past: [] };
      }

      const processedRSVPs: UserRSVPWithEvent[] = [];
      const now = new Date();

      // First, deduplicate RSVPs to get only the latest RSVP for each event
      const eventToLatestRSVP = new Map<string, EventRSVP>();

      for (const rsvp of rsvps) {
        const eventId = rsvp.tags.find((tag) => tag[0] === "e")?.[1];
        const addressTag = rsvp.tags.find((tag) => tag[0] === "a")?.[1];

        // Create a unique key for this event (prefer address coordinate over event ID)
        const eventKey = addressTag || eventId;
        if (!eventKey) continue;

        const existing = eventToLatestRSVP.get(eventKey);
        if (!existing || rsvp.created_at > existing.created_at) {
          eventToLatestRSVP.set(eventKey, rsvp);
        }
      }

      // Now process only the latest RSVP for each event
      for (const rsvp of eventToLatestRSVP.values()) {
        const eventId = rsvp.tags.find((tag) => tag[0] === "e")?.[1];
        const addressTag = rsvp.tags.find((tag) => tag[0] === "a")?.[1];
        const status = rsvp.tags.find((tag) => tag[0] === "status")?.[1] || "accepted";

        // Try to find event by ID first, then by address coordinate
        let event = eventId ? rsvpEvents.find((e) => e.id === eventId) : undefined;

        if (!event && addressTag) {
          const [kind, pubkey, identifier] = addressTag.split(':');
          event = rsvpEvents.find((e) =>
            e.kind === parseInt(kind) &&
            e.pubkey === pubkey &&
            e.tags.some((tag) => tag[0] === "d" && tag[1] === identifier)
          );
        }

        if (!event) continue;

        const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
        const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
        
        if (!startTime) continue;

        let eventDate: Date;

        if (event.kind === 31922) {
          // Date-only events: startTime is YYYY-MM-DD format
          eventDate = new Date(startTime + "T00:00:00Z");
        } else {
          // Time-based events (31923) and live events (30311, 30312, 30313): startTime is Unix timestamp
          eventDate = new Date(parseInt(startTime) * 1000);
        }

        processedRSVPs.push({
          rsvp,
          event,
          status,
          eventTitle: title,
          eventDate,
          eventStartTime: startTime,
        });
      }

      // Split into upcoming and past events
      const upcoming = processedRSVPs
        .filter(item => item.eventDate >= now)
        .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

      const past = processedRSVPs
        .filter(item => item.eventDate < now)
        .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

      return { upcoming, past };
    },
    enabled: !!rsvps.length && !!rsvpEvents.length,
    staleTime: 30000,
  });

  return {
    data: processedQuery.data,
    isLoading: isLoadingRSVPs || isLoadingRsvpEvents || processedQuery.isLoading,
    error: processedQuery.error,
  };
}