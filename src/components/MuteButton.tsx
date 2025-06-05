import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMuteList } from "@/hooks/useMuteList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { VolumeX, Volume2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface MuteButtonProps {
  pubkey: string;
  authorName: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  className?: string;
}

export function MuteButton({ 
  pubkey, 
  authorName, 
  size = "sm", 
  variant = "outline",
  className = "" 
}: MuteButtonProps) {
  const { user } = useCurrentUser();
  const { isMuted, mutePubkey, unmutePubkey, getMuteReason } = useMuteList();
  const [isLoading, setIsLoading] = useState(false);
  const [muteReason, setMuteReason] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't show mute button for own posts or when not logged in
  if (!user || user.pubkey === pubkey) {
    return null;
  }

  const isMutedUser = isMuted(pubkey);
  const currentReason = getMuteReason(pubkey);

  const handleMute = async () => {
    setIsLoading(true);
    try {
      await mutePubkey(pubkey, muteReason.trim());
      toast.success(`Muted ${authorName}`);
      setIsDialogOpen(false);
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

  if (isMutedUser) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleUnmute}
        disabled={isLoading}
        className={`flex items-center gap-1 ${className}`}
        title={currentReason ? `Muted: ${currentReason}` : "Click to unmute"}
      >
        <Volume2 className="h-3 w-3" />
        {isLoading ? "..." : "Unmute"}
      </Button>
    );
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`flex items-center gap-1 ${className}`}
        >
          <VolumeX className="h-3 w-3" />
          Mute
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mute {authorName}?</AlertDialogTitle>
          <AlertDialogDescription>
            You won't see events from this user in your feed. You can unmute them later.
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
  );
}