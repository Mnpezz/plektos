import { useState } from "react";
import { nip19 } from "nostr-tools";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { NSchema as n } from "@nostrify/nostrify";
import type { NostrMetadata } from "@nostrify/nostrify";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserSearch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { genUserName } from "@/lib/genUserName";

export interface Participant {
  pubkey: string;
  npub: string;
  metadata?: NostrMetadata;
  displayName: string;
  role: string;
}

interface ParticipantSearchProps {
  value?: Participant;
  onChange: (participant: Participant) => void;
  className?: string;
}

export function ParticipantSearch({
  value,
  onChange,
  className,
}: ParticipantSearchProps) {
  const { nostr } = useNostr();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Helper function to verify NIP-05 address
  const verifyNip05 = async (address: string, signal: AbortSignal): Promise<string | null> => {
    try {
      const [name, domain] = address.split('@');
      if (!name || !domain) return null;

      const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
      const response = await fetch(url, { signal });

      if (!response.ok) return null;

      const data = await response.json();
      return data.names?.[name] || null;
    } catch {
      return null;
    }
  };

  // Search for users based on query
  const { data: searchResults = [], isLoading, error } = useQuery({
    queryKey: ["participant-search", searchQuery],
    queryFn: async ({ signal }) => {
      if (!searchQuery) {
        return [];
      }

      // For npub and NIP-05 addresses, we don't need minimum length
      const isNpub = searchQuery.startsWith("npub1");
      const isNip05 = searchQuery.includes('@') && searchQuery.split('@').length === 2;

      if (!isNpub && !isNip05 && searchQuery.length < 3) {
        return [];
      }

      // If the query looks like an npub, try to decode it
      if (isNpub) {
        try {
          const decoded = nip19.decode(searchQuery);
          if (decoded.type === "npub") {
            const pubkey = decoded.data;

            // Always return a result for valid npubs, even if we can't find metadata
            try {
              const events = await nostr.query(
                [{ kinds: [0], authors: [pubkey], limit: 1 }],
                { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
              );

              const event = events[0];
              let metadata: NostrMetadata | undefined;
              if (event) {
                try {
                  metadata = n.json().pipe(n.metadata()).parse(event.content);
                } catch {
                  // Ignore parsing errors
                }
              }

              const result = {
                pubkey,
                npub: searchQuery, // Use the original npub
                metadata,
                displayName: metadata?.name || metadata?.display_name || genUserName(pubkey),
              };
              return [result];
            } catch {
              // If nostr query fails, still return the basic info
              const fallbackResult = {
                pubkey,
                npub: searchQuery,
                metadata: undefined,
                displayName: genUserName(pubkey),
              };
              return [fallbackResult];
            }
          }
        } catch {
          // If decode fails, return empty
          return [];
        }
      }

      // If the query looks like a NIP-05 address (contains @), try to verify it
      if (isNip05) {
        try {
          const pubkey = await verifyNip05(searchQuery, signal);
          if (pubkey) {
            const events = await nostr.query(
              [{ kinds: [0], authors: [pubkey], limit: 1 }],
              { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
            );

            const event = events[0];
            let metadata: NostrMetadata | undefined;
            if (event) {
              try {
                metadata = n.json().pipe(n.metadata()).parse(event.content);
              } catch {
                // Ignore parsing errors
              }
            }

            return [
              {
                pubkey,
                npub: nip19.npubEncode(pubkey),
                metadata,
                displayName: metadata?.name || metadata?.display_name || genUserName(pubkey),
              },
            ];
          }
        } catch {
          // If NIP-05 verification fails, continue with text search
        }
      }

      // Search for users by name/display_name in their metadata
      const events = await nostr.query(
        [{ kinds: [0], search: searchQuery, limit: 20 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      const results = events
        .map((event) => {
          let metadata: NostrMetadata | undefined;
          try {
            metadata = n.json().pipe(n.metadata()).parse(event.content);
          } catch {
            return null;
          }

          const displayName = metadata?.name || metadata?.display_name || genUserName(event.pubkey);

          // Only include if the query matches the name or display_name
          if (
            displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            metadata?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            metadata?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            return {
              pubkey: event.pubkey,
              npub: nip19.npubEncode(event.pubkey),
              metadata,
              displayName,
            };
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 10); // Limit to 10 results

      return results;
    },
    enabled: !!searchQuery && (searchQuery.length >= 3 || searchQuery.startsWith("npub1") || (searchQuery.includes('@') && searchQuery.split('@').length === 2)),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });


  const handleSelect = (result: typeof searchResults[0]) => {
    if (result) {
      const participant: Participant = {
        ...result,
        role: "speaker", // Default role
      };
      onChange(participant);
      setOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm">Search Participants</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left max-w-full"
          >
            <div className="flex-1 min-w-0">
              {value ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={value.metadata?.picture} />
                    <AvatarFallback className="text-xs">
                      {value.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate block text-sm" title={value.displayName}>
                    {value.displayName}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Search for participants...
                </span>
              )}
            </div>
            <UserSearch className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 max-w-[90vw]"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, npub, or nostr address..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="text-sm"
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : searchQuery.length < 3 && !searchQuery.startsWith("npub1") && !(searchQuery.includes('@') && searchQuery.split('@').length === 2) ? (
                  "Type at least 3 characters to search..."
                ) : error ? (
                  <div className="text-red-500">Error: {error.message}</div>
                ) : (
                  "No participants found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((result) => (
                  <CommandItem
                    key={result.pubkey}
                    value={result.displayName}
                    onSelect={() => handleSelect(result)}
                    className="text-sm"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={result.metadata?.picture} />
                        <AvatarFallback className="text-xs">
                          {result.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium" title={result.displayName}>
                          {result.displayName}
                        </div>
                        {result.metadata?.about && (
                          <div className="truncate text-xs text-muted-foreground" title={result.metadata.about}>
                            {result.metadata.about}
                          </div>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}