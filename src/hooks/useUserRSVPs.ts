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

interface UserTicketWithEvent {
  zapReceipt: {
    id: string;
    kind: number;
    pubkey: string;
    created_at: number;
    content: string;
    tags: string[][];
  }; // Zap receipt event (kind 9735)
  event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom;
  amount: number;
  eventTitle: string;
  eventDate: Date;
  eventStartTime?: string;
  isTicket: boolean; // true for purchased tickets, false for RSVPs
}

export type { UserRSVPWithEvent, UserTicketWithEvent };

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

  // Fetch user's purchased tickets (zap receipts where user is the recipient)
  const { data: zapReceipts = [], isLoading: isLoadingZapReceipts } = useQuery({
    queryKey: ["userZapReceipts", user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return [];
      const events = await nostr.query(
        [{ kinds: [9735], "#p": [user.pubkey] }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );
      return events;
    },
    enabled: !!user?.pubkey,
    retry: 1,
    staleTime: 30000,
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

  // Fetch events for zap receipts (purchased tickets)
  const { data: ticketEvents = [], isLoading: isLoadingTicketEvents } = useQuery({
    queryKey: ["userTicketEvents", zapReceipts],
    queryFn: async ({ signal }) => {
      if (!zapReceipts.length) return [];

      // Extract event IDs from zap receipts
      const eventIds = zapReceipts
        .map((receipt) => receipt.tags.find((tag) => tag[0] === "e")?.[1])
        .filter((id): id is string => id !== undefined);

      if (eventIds.length === 0) return [];

      const events = await nostr.query(
        [{ kinds: [31922, 31923, 30311, 30312, 30313], ids: eventIds }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );

      return events as unknown as (DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom)[];
    },
    enabled: !!zapReceipts.length,
    retry: 1,
    staleTime: 30000,
  });

  const processedQuery = useQuery({
    queryKey: ["processedUserTickets", rsvps, rsvpEvents, zapReceipts, ticketEvents],
    queryFn: async (): Promise<{ upcoming: (UserRSVPWithEvent | UserTicketWithEvent)[], past: (UserRSVPWithEvent | UserTicketWithEvent)[] }> => {
      console.log("🔍 Processing user tickets/RSVPs:", {
        rsvpsCount: rsvps.length,
        rsvpEventsCount: rsvpEvents.length,
        zapReceiptsCount: zapReceipts.length,
        ticketEventsCount: ticketEvents.length,
        rsvps: rsvps.map(r => ({ id: r.id, tags: r.tags, content: r.content })),
        rsvpEvents: rsvpEvents.map(e => ({ id: e.id, kind: e.kind, title: e.tags.find(t => t[0] === 'title')?.[1] }))
      });
      
      const processedRSVPs: UserRSVPWithEvent[] = [];
      const processedTickets: UserTicketWithEvent[] = [];
      const now = new Date();

      // Process RSVPs
      if (rsvps.length && rsvpEvents.length) {
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

          console.log("🔍 Processing RSVP:", {
            rsvpId: rsvp.id,
            eventId,
            addressTag,
            status,
            rsvpTags: rsvp.tags
          });

          // Try to find event by ID first, then by address coordinate
          let event = eventId ? rsvpEvents.find((e) => e.id === eventId) : undefined;

          if (!event && addressTag) {
            const [kind, pubkey, identifier] = addressTag.split(':');
            console.log("🔍 Looking for event by address:", { kind, pubkey, identifier });
            event = rsvpEvents.find((e) =>
              e.kind === parseInt(kind) &&
              e.pubkey === pubkey &&
              e.tags.some((tag) => tag[0] === "d" && tag[1] === identifier)
            );
          }

          console.log("🔍 Found event:", event ? { id: event.id, kind: event.kind, title: event.tags.find(t => t[0] === 'title')?.[1] } : "NOT FOUND");

          if (!event) continue;

          const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
          let startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
          
          console.log("🔍 Processing event date:", {
            title,
            startTime,
            eventKind: event.kind,
            eventId: event.id,
            allTags: event.tags
          });

          if (!startTime) {
            console.log("🔍 No start time found, checking for alternative time tags...");
            
            // For live events, try alternative time tags
            const alternativeStartTime = event.tags.find((tag) => 
              tag[0] === "start_tzid" || 
              tag[0] === "published_at" || 
              tag[0] === "created_at"
            )?.[1];
            
            if (alternativeStartTime) {
              console.log("🔍 Found alternative start time:", alternativeStartTime);
              startTime = alternativeStartTime;
            } else {
              // For live events without start time, treat as ongoing (show in upcoming)
              console.log("🔍 No start time found, treating as ongoing live event");
              startTime = "0"; // Use epoch time to ensure it's treated as upcoming
            }
          }

          let eventDate: Date;

          if (event.kind === 31922) {
            // Date-only events: startTime is YYYY-MM-DD format
            eventDate = new Date(startTime + "T00:00:00Z");
          } else {
            // Time-based events (31923) and live events (30311, 30312, 30313): startTime is Unix timestamp
            eventDate = new Date(parseInt(startTime) * 1000);
          }

          console.log("🔍 Calculated event date:", {
            title,
            eventDate: eventDate.toISOString(),
            now: new Date().toISOString(),
            isUpcoming: eventDate >= new Date()
          });

          processedRSVPs.push({
            rsvp,
            event,
            status,
            eventTitle: title,
            eventDate,
            eventStartTime: startTime,
          });
        }
      }

      // Process purchased tickets (zap receipts)
      if (zapReceipts.length && ticketEvents.length) {
        for (const receipt of zapReceipts) {
          const eventId = receipt.tags.find((tag) => tag[0] === "e")?.[1];
          if (!eventId) continue;

          const event = ticketEvents.find((e) => e.id === eventId);
          if (!event) continue;

          // Parse zap request to get amount
          const descriptionTag = receipt.tags.find((tag) => tag[0] === "description")?.[1];
          let amount = 0;
          if (descriptionTag) {
            try {
              const zapRequest = JSON.parse(descriptionTag);
              const amountTag = zapRequest.tags?.find((tag: string[]) => tag[0] === "amount");
              if (amountTag) {
                amount = Math.floor(parseInt(amountTag[1]) / 1000); // Convert from millisats to sats
              }
            } catch (error) {
              console.error("Error parsing zap request:", error);
            }
          }

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

          processedTickets.push({
            zapReceipt: receipt,
            event,
            amount,
            eventTitle: title,
            eventDate,
            eventStartTime: startTime,
            isTicket: true,
          });
        }
      }

            // Combine RSVPs and tickets, then split into upcoming and past events
            const allItems = [...processedRSVPs, ...processedTickets];

            const upcoming = allItems
              .filter(item => item.eventDate >= now)
              .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());

            const past = allItems
              .filter(item => item.eventDate < now)
              .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

            console.log("🔍 Final results:", {
              totalItems: allItems.length,
              upcomingCount: upcoming.length,
              pastCount: past.length,
              upcoming: upcoming.map(item => ({ 
                title: item.eventTitle, 
                date: item.eventDate.toISOString(),
                isTicket: 'isTicket' in item ? item.isTicket : false
              })),
              past: past.map(item => ({ 
                title: item.eventTitle, 
                date: item.eventDate.toISOString(),
                isTicket: 'isTicket' in item ? item.isTicket : false
              }))
            });

            return { upcoming, past };
    },
    enabled: (!!rsvps.length && !!rsvpEvents.length) || (!!zapReceipts.length && !!ticketEvents.length),
    staleTime: 30000,
  });

  return {
    data: processedQuery.data,
    isLoading: isLoadingRSVPs || isLoadingRsvpEvents || isLoadingZapReceipts || isLoadingTicketEvents || processedQuery.isLoading,
    error: processedQuery.error,
  };
}
