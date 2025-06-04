import { NostrContext } from "@nostrify/react";
import { NPool, NRelay1, NostrEvent } from "@nostrify/nostrify";
import React, { useEffect, useState } from "react";

interface NostrProviderProps {
  children: React.ReactNode;
  relays: string[];
}

export default function NostrProvider({
  children,
  relays,
}: NostrProviderProps) {
  const [pool, setPool] = useState<NPool | null>(null);

  useEffect(() => {
    console.log("Initializing NostrProvider with relays:", relays);

    const newPool = new NPool({
      open(url: string) {
        console.log("Opening connection to relay:", url);
        return new NRelay1(url);
      },
      reqRouter(filters) {
        // Log the exact filters being sent to each relay
        const filterMap = new Map(relays.map((url) => [url, filters]));
        console.log("Sending filters to relays:", {
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
        return relays;
      },
    });

    setPool(newPool);

    // Cleanup function
    return () => {
      console.log("Cleaning up NostrProvider");
      newPool.close();
    };
  }, [relays]);

  if (!pool) {
    return null; // or a loading spinner
  }

  return (
    <NostrContext.Provider value={{ nostr: pool }}>
      {children}
    </NostrContext.Provider>
  );
}
