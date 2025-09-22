import { NostrContext } from "@nostrify/react";
import { NPool, NRelay1, NostrEvent } from "@nostrify/nostrify";
import React, { useEffect, useRef } from "react";

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

export default function NostrProvider({
  children,
  relays,
}: NostrProviderProps) {
  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const relayUrls = useRef<string[]>(relays);

  // Update refs when relays change
  useEffect(() => {
    relayUrls.current = relays;
  }, [relays]);

  // Initialize NPool only once
  if (!pool.current) {
    console.log("Initializing NostrProvider with relays:", relays);

    pool.current = new NPool({
      open(url: string) {
        console.log("Opening connection to relay:", url);
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Query ALL relays for better data coverage and consistency
        // NPool automatically deduplicates results from multiple relays
        const filterMap = new Map();
        relayUrls.current.forEach(url => {
          filterMap.set(url, filters);
        });
        console.log("Sending filters to ALL relays:", {
          filters: JSON.stringify(filters, null, 2),
          relays: Array.from(filterMap.keys()),
        });
        return filterMap;
      },
      eventRouter(event: NostrEvent) {
        console.log("Received event from relay:", {
          id: event.id,
          kind: event.kind,
          pubkey: event.pubkey,
        });
        // Publish to ALL configured relays for better distribution
        return relayUrls.current;
      },
    });
  }

  return (
    <NostrContext.Provider value={{ nostr: pool.current }}>
      {children}
    </NostrContext.Provider>
  );
}
