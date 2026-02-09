import { useQuery } from "@tanstack/react-query";
import { useNostr } from "@nostrify/react";
import type { EventRSVP } from "@/lib/eventTypes";

/**
 * Fetches RSVPs for a specific event by its ID and/or address coordinate.
 * Much more efficient than fetching all 500 events with RSVPs.
 */
export function useEventRSVPs(eventId?: string, eventAddress?: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ["eventRSVPs", eventId, eventAddress],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      const filters: Array<{ kinds: number[]; "#e"?: string[]; "#a"?: string[] }> = [];

      // Filter by event ID (e tag)
      if (eventId) {
        filters.push({ kinds: [31925], "#e": [eventId] });
      }

      // Filter by address coordinate (a tag) for replaceable events
      if (eventAddress) {
        filters.push({ kinds: [31925], "#a": [eventAddress] });
      }

      if (filters.length === 0) return [];

      const events = await nostr.query(filters, { signal });
      return events as unknown as EventRSVP[];
    },
    enabled: !!(eventId || eventAddress),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
