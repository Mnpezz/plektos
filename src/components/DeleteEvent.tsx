import { useState } from "react";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

interface DeleteEventProps {
  eventId: string;
  eventKind: number;
  onDeleted?: () => void;
}

export function DeleteEvent({
  eventId,
  eventKind,
  onDeleted,
}: DeleteEventProps) {
  const { user } = useCurrentUser();
  const { mutate: createEvent } = useNostrPublish();
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState("");

  const handleDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      await createEvent({
        kind: 5,
        content: reason || "Event deleted by author",
        tags: [
          ["e", eventId],
          ["k", eventKind.toString()],
        ],
      });

      toast.success("Event deleted successfully");
      onDeleted?.();
    } catch (error) {
      toast.error("Failed to delete event");
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete Event
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Event</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this event? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Reason for deletion (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mb-4"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
