import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";

interface RelayInfo {
  read?: boolean;
  write?: boolean;
}

export function useUserRelays() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ["userRelays", user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return [];

      // Query for kind 10002 relay list events
      const events = await nostr.query(
        [{ kinds: [10002], authors: [user.pubkey], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }
      );

      if (!events.length) return [];

      const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
      const relayUrls: string[] = [];

      try {
        // Parse relay info from content if available
        if (latestEvent.content) {
          const relayMap = JSON.parse(latestEvent.content) as Record<string, RelayInfo>;
          for (const [url, info] of Object.entries(relayMap)) {
            // Include relays that are marked for writing or have no specific write flag
            if (info.write !== false) {
              relayUrls.push(url);
            }
          }
        }

        // Also include relays from 'r' tags
        for (const tag of latestEvent.tags) {
          if (tag[0] === 'r' && tag[1]) {
            const url = tag[1];
            const marker = tag[2]; // 'read' or 'write' or undefined
            
            // Include if it's for writing or no marker specified
            if (!marker || marker === 'write') {
              if (!relayUrls.includes(url)) {
                relayUrls.push(url);
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to parse relay list:", error);
      }

      return relayUrls;
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}