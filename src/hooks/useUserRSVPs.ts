import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { DateBasedEvent, TimeBasedEvent, EventRSVP } from "@/lib/eventTypes";

interface UserRSVPWithEvent {
  rsvp: EventRSVP;
  event: DateBasedEvent | TimeBasedEvent;
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
      const eventIds = rsvps
        .map((rsvp) => rsvp.tags.find((tag) => tag[0] === "e")?.[1])
        .filter((id): id is string => id !== undefined);
      if (!eventIds.length) return [];
      const events = await nostr.query(
        [{ kinds: [31922, 31923], ids: eventIds }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );
      return events as unknown as (DateBasedEvent | TimeBasedEvent)[];
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

      for (const rsvp of rsvps) {
        const eventId = rsvp.tags.find((tag) => tag[0] === "e")?.[1];
        const status = rsvp.tags.find((tag) => tag[0] === "status")?.[1] || "accepted";
        const event = rsvpEvents.find((e) => e.id === eventId);

        if (!eventId || !event) continue;

        const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
        const startTime = event.tags.find((tag) => tag[0] === "start")?.[1];
        
        if (!startTime) continue;

        let eventDate: Date;
        
        if (event.kind === 31922) {
          // Date-only events: startTime is YYYY-MM-DD format
          eventDate = new Date(startTime + "T00:00:00Z");
        } else {
          // Time-based events: startTime is Unix timestamp
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