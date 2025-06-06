import { useNostr } from "@nostrify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import type { NostrEvent } from "@nostrify/nostrify";

export interface FollowListEvent extends NostrEvent {
  kind: 3;
}

/**
 * Hook for managing NIP-02 Contact Lists (follows)
 * Fetches and manages the user's follow list (kind 3)
 */
export function useFollowList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Fetch the user's follow list
  const {
    data: followList,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["followList", user?.pubkey],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey) return null;

      const events = await nostr.query(
        [
          {
            kinds: [3], // NIP-02 contact list
            authors: [user.pubkey],
            limit: 10, // Get more events to ensure we have the latest
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );
      
      if (events.length === 0) {
        return null;
      }
      
      // Sort by created_at descending to ensure we get the most recent
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at);
      return sortedEvents[0] as FollowListEvent;
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Get the list of followed pubkeys from the follow list
  const followedPubkeys = followList?.tags
    .filter((tag) => tag[0] === "p")
    .map((tag) => tag[1]) || [];

  // Check if a pubkey is followed
  const isFollowing = (pubkey: string): boolean => {
    return followedPubkeys.includes(pubkey);
  };

  // Follow a pubkey
  const followPubkey = async (pubkey: string, relayUrl: string = "") => {
    if (!user) {
      throw new Error("User must be logged in to follow");
    }

    // Get current follow list tags
    const currentTags = followList?.tags || [];
    
    // Check if already following
    if (currentTags.some(tag => tag[0] === "p" && tag[1] === pubkey)) {
      return; // Already following
    }

    // Add the new followed pubkey
    const newTags = [
      ...currentTags,
      relayUrl ? ["p", pubkey, relayUrl] : ["p", pubkey]
    ];

    // Preserve existing content (usually a JSON string of relay information)
    const content = followList?.content || "";

    await publishEvent({
      kind: 3,
      content,
      tags: newTags,
    });

    // Invalidate queries to refresh the follow list
    queryClient.invalidateQueries({ queryKey: ["followList", user.pubkey] });
  };

  // Unfollow a pubkey
  const unfollowPubkey = async (pubkey: string) => {
    if (!user) {
      throw new Error("User must be logged in to unfollow");
    }

    if (!followList) {
      return; // No follow list exists
    }

    // Remove the pubkey from the follow list
    const newTags = followList.tags.filter(
      tag => !(tag[0] === "p" && tag[1] === pubkey)
    );

    // Preserve existing content
    const content = followList.content || "";

    await publishEvent({
      kind: 3,
      content,
      tags: newTags,
    });

    // Invalidate queries to refresh the follow list
    queryClient.invalidateQueries({ queryKey: ["followList", user.pubkey] });
  };

  // Get the relay URL for a specific followed pubkey
  const getFollowRelay = (pubkey: string): string => {
    const followTag = followList?.tags.find(
      tag => tag[0] === "p" && tag[1] === pubkey
    );
    return followTag?.[2] || ""; // Relay URL is in the 3rd element (index 2)
  };

  // Get follow count
  const followCount = followedPubkeys.length;

  return {
    followList,
    followedPubkeys,
    followCount,
    isLoading,
    isFollowing,
    followPubkey,
    unfollowPubkey,
    getFollowRelay,
    refetch,
  };
}