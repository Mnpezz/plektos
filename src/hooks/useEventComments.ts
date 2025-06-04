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

export function useEventComments(eventId: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Fetch comments for the event
  const {
    data: comments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["comments", eventId],
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [
          {
            kinds: [1111], // NIP-22 comment events
            "#e": [eventId],
            limit: 100,
          },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }
      );

      // Sort comments by creation time
      return events.sort((a, b) => a.created_at - b.created_at) as CommentEvent[];
    },
    enabled: !!eventId,
  });

  // Fetch reactions for all comments
  const commentIds = comments.map((c) => c.id);
  const {
    data: reactions = [],
  } = useQuery({
    queryKey: ["reactions", ...commentIds],
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
      tags: [["e", eventId]],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: user.pubkey,
      sig: "temp-sig", // Temporary signature
    };

    // Optimistically update comments
    const commentsQueryKey = ["comments", eventId];
    queryClient.setQueryData(commentsQueryKey, (oldComments: CommentEvent[] = []) => {
      return [...oldComments, optimisticComment].sort((a, b) => a.created_at - b.created_at);
    });

    try {
      // Publish the actual comment
      await publishEvent({
        kind: 1111,
        content,
        tags: [
          ["e", eventId],
        ],
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
    const reactionsQueryKey = ["reactions", ...commentIds];
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