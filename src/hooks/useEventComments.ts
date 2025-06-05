import { useNostr } from "@nostrify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import type { NostrEvent } from "@nostrify/nostrify";

interface CommentEvent extends NostrEvent {
  kind: 1111;
}

interface ReactionEvent extends NostrEvent {
  kind: 7;
}

export function useEventComments(
  eventId: string, 
  eventKind?: number, 
  eventPubkey?: string, 
  eventIdentifier?: string
) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Determine if this is a replaceable event
  const isReplaceable = eventKind ? eventKind >= 30000 && eventKind < 40000 : false;
  const eventCoordinate = isReplaceable && eventKind && eventPubkey && eventIdentifier 
    ? `${eventKind}:${eventPubkey}:${eventIdentifier}` 
    : undefined;

  // Fetch comments for the event
  const {
    data: comments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["comments", eventId, eventCoordinate],
    queryFn: async ({ signal }) => {
      // For replaceable events, query both by event ID and coordinate
      const filters: Array<{
        kinds: number[]; 
        "#e"?: string[];
        "#a"?: string[];
        limit: number;
      }> = [
        {
          kinds: [1111], // NIP-22 comment events
          "#e": [eventId],
          limit: 100,
        }
      ];

      // For replaceable events, also query by coordinate
      if (eventCoordinate) {
        filters.push({
          kinds: [1111],
          "#a": [eventCoordinate],
          limit: 100,
        });
      }

      const events = await nostr.query(
        filters,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Deduplicate comments (in case a comment has both e and a tags)
      const uniqueComments = events.reduce((acc, event) => {
        if (!acc.find((c) => c.id === event.id)) {
          acc.push(event);
        }
        return acc;
      }, [] as NostrEvent[]);

      // Sort comments by creation time
      return uniqueComments.sort((a, b) => a.created_at - b.created_at) as CommentEvent[];
    },
    enabled: !!eventId,
  });

  // Fetch reactions for all comments
  const commentIds = comments.map((c) => c.id);
  const {
    data: reactions = [],
  } = useQuery({
    queryKey: ["reactions", eventId, eventCoordinate, ...commentIds],
    queryFn: async ({ signal }) => {
      if (commentIds.length === 0) return [];
      
      const events = await nostr.query(
        [
          {
            kinds: [7], // Reaction events
            "#e": commentIds,
            limit: 500,
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      return events as ReactionEvent[];
    },
    enabled: commentIds.length > 0,
  });

  // Post a new comment with optimistic update
  const postComment = async (content: string) => {
    if (!user) {
      throw new Error("User must be logged in to comment");
    }

    // Create optimistic comment event
    const optimisticComment: CommentEvent = {
      id: `temp-${Date.now()}`, // Temporary ID
      kind: 1111,
      content,
      tags: isReplaceable && eventCoordinate 
        ? [
            ["e", eventId], // Reference to specific event ID
            ["a", eventCoordinate], // Reference to replaceable event coordinate
            ["E", eventId], // Root reference (NIP-10)
            ["A", eventCoordinate], // Addressable root reference
            ["k", eventKind!.toString()], // Event kind being commented on
          ]
        : [
            ["e", eventId],
            ["E", eventId], // Root reference (NIP-10)
            ["k", eventKind?.toString() || "1"], // Default to kind 1 if not specified
          ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: user.pubkey,
      sig: "temp-sig", // Temporary signature
    };

    // Optimistically update comments
    const commentsQueryKey = ["comments", eventId, eventCoordinate];
    queryClient.setQueryData(commentsQueryKey, (oldComments: CommentEvent[] = []) => {
      return [...oldComments, optimisticComment].sort((a, b) => a.created_at - b.created_at);
    });

    try {
      // Publish the actual comment with proper NIP-22 tagging
      const tags: string[][] = isReplaceable && eventCoordinate 
        ? [
            ["e", eventId], // Reference to specific event ID
            ["a", eventCoordinate], // Reference to replaceable event coordinate  
            ["E", eventId], // Root reference (NIP-10)
            ["A", eventCoordinate], // Addressable root reference
            ["k", eventKind!.toString()], // Event kind being commented on
          ]
        : [
            ["e", eventId],
            ["E", eventId], // Root reference (NIP-10)
            ["k", eventKind?.toString() || "1"], // Default to kind 1 if not specified
          ];

      // Add author reference if available
      if (eventPubkey) {
        tags.push(["p", eventPubkey]);
      }

      await publishEvent({
        kind: 1111,
        content,
        tags,
      });

      // Invalidate and refetch to get the real comment with proper ID and signature
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(commentsQueryKey, (currentComments: CommentEvent[] = []) => {
        return currentComments.filter(c => c.id !== optimisticComment.id);
      });
      throw error;
    }
  };

  // Add a like reaction to a comment with optimistic update
  const likeComment = async (commentId: string) => {
    if (!user) {
      throw new Error("User must be logged in to react");
    }

    // Check if user already liked this comment
    const userReaction = reactions.find(
      (r) =>
        r.pubkey === user.pubkey &&
        r.tags.some((tag) => tag[0] === "e" && tag[1] === commentId) &&
        r.content === "+"
    );

    if (userReaction) {
      // User already liked, could remove like (not implemented for simplicity)
      return;
    }

    // Create optimistic reaction event
    const optimisticReaction: ReactionEvent = {
      id: `temp-${Date.now()}`, // Temporary ID
      kind: 7,
      content: "+",
      tags: [
        ["e", commentId],
        ["p", comments.find((c) => c.id === commentId)?.pubkey || ""],
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: user.pubkey,
      sig: "temp-sig", // Temporary signature
    };

    // Optimistically update reactions
    const reactionsQueryKey = ["reactions", eventId, eventCoordinate, ...commentIds];
    queryClient.setQueryData(reactionsQueryKey, (oldReactions: ReactionEvent[] = []) => {
      return [...oldReactions, optimisticReaction];
    });

    try {
      // Publish the actual reaction
      await publishEvent({
        kind: 7,
        content: "+",
        tags: [
          ["e", commentId],
          ["p", comments.find((c) => c.id === commentId)?.pubkey || ""],
        ],
      });

      // Invalidate and refetch to get the real reaction with proper ID and signature
      queryClient.invalidateQueries({ queryKey: reactionsQueryKey });
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueryData(reactionsQueryKey, (currentReactions: ReactionEvent[] = []) => {
        return currentReactions.filter(r => r.id !== optimisticReaction.id);
      });
      throw error;
    }
  };

  // Get like count for a comment
  const getLikeCount = (commentId: string) => {
    return reactions.filter(
      (r) =>
        r.tags.some((tag) => tag[0] === "e" && tag[1] === commentId) &&
        r.content === "+"
    ).length;
  };

  // Check if current user liked a comment
  const hasUserLiked = (commentId: string) => {
    if (!user) return false;
    
    return reactions.some(
      (r) =>
        r.pubkey === user.pubkey &&
        r.tags.some((tag) => tag[0] === "e" && tag[1] === commentId) &&
        r.content === "+"
    );
  };

  return {
    comments,
    reactions,
    isLoading,
    postComment,
    likeComment,
    getLikeCount,
    hasUserLiked,
    refetch,
  };
}