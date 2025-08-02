import { useState } from "react";
import { useReminders } from "@/lib/reminders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DateBasedEvent, TimeBasedEvent, LiveEvent, RoomMeeting } from "@/lib/eventTypes";

interface ReminderPanelProps {
  event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting;
  isHost: boolean;
  participants: string[]; // Array of participant pubkeys
}

export function ReminderPanel({
  event,
  isHost,
  participants,
}: ReminderPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { sendBulkReminders } = useReminders(event);

  if (!isHost || participants.length === 0) {
    return null;
  }

  const handleSendReminders = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      await sendBulkReminders(participants, message);
      toast.success("Reminders sent successfully");
      setIsOpen(false);
      setMessage("");
    } catch (error) {
      toast.error("Failed to send reminders");
      console.error("Error sending reminders:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-4">Send Reminders</h3>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Send Reminders</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reminders to Participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your reminder message"
                rows={4}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This message will be sent to {participants.length} participant
              {participants.length !== 1 ? "s" : ""}
            </p>
            <Button
              onClick={handleSendReminders}
              disabled={!message.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send Reminders"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
