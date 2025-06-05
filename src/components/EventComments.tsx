import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEventComments } from "@/hooks/useEventComments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CommentItem } from "@/components/CommentItem";
import { toast } from "sonner";

interface EventCommentsProps {
  eventId: string;
  eventTitle: string;
  eventKind?: number;
  eventPubkey?: string;
  eventIdentifier?: string; // the "d" tag value for replaceable events
}

export function EventComments({ 
  eventId, 
  eventTitle, 
  eventKind, 
  eventPubkey, 
  eventIdentifier 
}: EventCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  
  const { user } = useCurrentUser();
  const {
    comments,
    isLoading,
    postComment,
    likeComment,
    getLikeCount,
    hasUserLiked,
  } = useEventComments(eventId, eventKind, eventPubkey, eventIdentifier);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user) return;

    setIsPosting(true);
    try {
      await postComment(newComment);
      setNewComment("");
      toast.success("Comment posted!");
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.error("Please log in to like comments");
      return;
    }
    
    try {
      await likeComment(commentId);
    } catch (error) {
      console.error("Error liking comment:", error);
      toast.error("Failed to like comment");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isPosting) {
      e.preventDefault();
      handlePostComment();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-semibold">Discussion</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading comments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Discussion</h3>
        <span className="text-sm text-muted-foreground">
          ({comments.length} {comments.length === 1 ? "comment" : "comments"})
        </span>
      </div>

      {/* New Comment Form */}
      {user ? (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Share your thoughts about ${eventTitle}...`}
            className="min-h-[80px] resize-none"
            disabled={isPosting}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Press Ctrl+Enter to post
            </span>
            <Button
              onClick={handlePostComment}
              disabled={!newComment.trim() || isPosting}
              size="sm"
              className="gap-2"
            >
              <Send className="h-3 w-3" />
              {isPosting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Please log in to join the discussion
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet.</p>
            <p className="text-xs">Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              likeCount={getLikeCount(comment.id)}
              hasUserLiked={hasUserLiked(comment.id)}
              onLike={() => handleLikeComment(comment.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}