import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface Reminder {
  eventId: string;
  recipientPubkey: string;
  message: string;
  timestamp: number;
}

export function useReminders(event: DateBasedEvent | TimeBasedEvent) {
  const { mutate: publishEvent } = useNostrPublish();
  const { user } = useCurrentUser();

  const sendReminder = async (recipientPubkey: string, message: string) => {
    if (!user?.signer.nip44) {
      throw new Error("Your signer does not support NIP-44 encryption");
    }

    // Encrypt the reminder message
    const encryptedMessage = await user.signer.nip44.encrypt(
      recipientPubkey,
      message
    );

    // Create a reminder event (kind 1059)
    await publishEvent({
      kind: 1059,
      content: encryptedMessage,
      tags: [
        ["e", event.id], // Reference to the event
        ["p", recipientPubkey], // Recipient's pubkey
      ],
    });
  };

  const sendBulkReminders = async (recipients: string[], message: string) => {
    if (!user?.signer.nip44) {
      throw new Error("Your signer does not support NIP-44 encryption");
    }

    // Send reminders to all recipients
    await Promise.all(
      recipients.map((recipient) => sendReminder(recipient, message))
    );
  };

  return {
    sendReminder,
    sendBulkReminders,
  };
}
