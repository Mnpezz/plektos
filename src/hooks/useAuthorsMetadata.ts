import { type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthorsMetadata(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery<Record<string, NostrMetadata>>({
    queryKey: ['authors-metadata', pubkeys.sort()],
    queryFn: async ({ signal }) => {
      if (pubkeys.length === 0) {
        return {};
      }

      const events = await nostr.query(
        [{ kinds: [0], authors: pubkeys, limit: pubkeys.length }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) },
      );

      const metadataMap: Record<string, NostrMetadata> = {};

      for (const event of events) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          metadataMap[event.pubkey] = metadata;
        } catch {
          // If parsing fails, skip this metadata
        }
      }

      return metadataMap;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: pubkeys.length > 0,
  });
}