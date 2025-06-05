import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMuteList } from "@/hooks/useMuteList";
import { useFollowList } from "@/hooks/useFollowList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { 
  MoreVertical, 
  VolumeX, 
  Volume2, 
  UserPlus, 
  UserMinus,
  Flag
} from "lucide-react";

interface UserActionsMenuProps {
  pubkey: string;
  authorName: string;
  className?: string;
}

export function UserActionsMenu({ 
  pubkey, 
  authorName,
  className = ""
}: UserActionsMenuProps) {
  const { user } = useCurrentUser();
  const { isMuted, mutePubkey, unmutePubkey, getMuteReason } = useMuteList();
  const { isFollowing, followPubkey, unfollowPubkey } = useFollowList();
  const [isLoading, setIsLoading] = useState(false);
  const [muteReason, setMuteReason] = useState("");
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

  // Don't show menu for own posts or when not logged in
  if (!user || user.pubkey === pubkey) {
    return null;
  }

  const isMutedUser = isMuted(pubkey);
  const isFollowingUser = isFollowing(pubkey);
  const currentMuteReason = getMuteReason(pubkey);

  const handleMute = async () => {
    setIsLoading(true);
    try {
      await mutePubkey(pubkey, muteReason.trim());
      toast.success(`Muted ${authorName}`);
      setShowMuteDialog(false);
      setMuteReason("");
    } catch (error) {
      console.error("Error muting user:", error);
      toast.error("Failed to mute user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnmute = async () => {
    setIsLoading(true);
    try {
      await unmutePubkey(pubkey);
      toast.success(`Unmuted ${authorName}`);
    } catch (error) {
      console.error("Error unmuting user:", error);
      toast.error("Failed to unmute user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    setIsLoading(true);
    try {
      await followPubkey(pubkey);
      toast.success(`Now following ${authorName}`);
    } catch (error) {
      console.error("Error following user:", error);
      toast.error("Failed to follow user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setIsLoading(true);
    try {
      await unfollowPubkey(pubkey);
      toast.success(`Unfollowed ${authorName}`);
      setShowUnfollowDialog(false);
    } catch (error) {
      console.error("Error unfollowing user:", error);
      toast.error("Failed to unfollow user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${className}`}
            title="User actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Follow/Unfollow */}
          {isFollowingUser ? (
            <DropdownMenuItem
              onClick={() => setShowUnfollowDialog(true)}
              disabled={isLoading}
              className="flex items-center gap-2 text-red-600"
            >
              <UserMinus className="h-4 w-4" />
              Unfollow {authorName}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={handleFollow}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Follow {authorName}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Mute/Unmute */}
          {isMutedUser ? (
            <DropdownMenuItem
              onClick={handleUnmute}
              disabled={isLoading}
              className="flex items-center gap-2"
              title={currentMuteReason ? `Muted: ${currentMuteReason}` : undefined}
            >
              <Volume2 className="h-4 w-4" />
              Unmute {authorName}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowMuteDialog(true)}
              disabled={isLoading}
              className="flex items-center gap-2 text-red-600"
            >
              <VolumeX className="h-4 w-4" />
              Mute {authorName}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Report (placeholder for future functionality) */}
          <DropdownMenuItem
            disabled
            className="flex items-center gap-2 text-muted-foreground"
          >
            <Flag className="h-4 w-4" />
            Report (coming soon)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mute Confirmation Dialog */}
      <AlertDialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mute {authorName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't see content from this user in your feed. You can unmute them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Reason (optional)
            </label>
            <Textarea
              value={muteReason}
              onChange={(e) => setMuteReason(e.target.value)}
              placeholder="Why are you muting this user?"
              className="min-h-[80px]"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMute}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Muting..." : "Mute User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unfollow Confirmation Dialog */}
      <AlertDialog open={showUnfollowDialog} onOpenChange={setShowUnfollowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow {authorName}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer see updates from {authorName} in your feed. You can follow them again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnfollow}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Unfollowing..." : "Unfollow"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}