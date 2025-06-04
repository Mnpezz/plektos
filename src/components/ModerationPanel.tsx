import { useState } from "react";
import { useModeration } from "@/lib/moderation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DateBasedEvent, TimeBasedEvent } from "@/lib/eventTypes";

interface ModerationPanelProps {
  event: DateBasedEvent | TimeBasedEvent;
  isHost: boolean;
}

export function ModerationPanel({ event, isHost }: ModerationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockingPubkey, setBlockingPubkey] = useState("");
  const { blockUser } = useModeration(event);

  if (!isHost) {
    return null;
  }

  const handleBlock = async () => {
    try {
      await blockUser(blockingPubkey, blockReason);
      toast.success("User blocked successfully");
      setIsOpen(false);
      setBlockReason("");
      setBlockingPubkey("");
    } catch (error) {
      toast.error("Failed to block user");
      console.error("Error blocking user:", error);
    }
  };

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-4">Moderation</h3>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Block User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pubkey">User's Public Key</Label>
              <Input
                id="pubkey"
                value={blockingPubkey}
                onChange={(e) => setBlockingPubkey(e.target.value)}
                placeholder="npub1..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Reason for blocking"
              />
            </div>
            <Button onClick={handleBlock} disabled={!blockingPubkey}>
              Block User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
