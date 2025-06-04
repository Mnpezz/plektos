import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";
import { useDirectMessage } from "@/hooks/useDirectMessage";

export interface Reminder {
  eventId: string;
  recipientPubkey: string;
  message: string;
  timestamp: number;
}

export function useReminders(event: DateBasedEvent | TimeBasedEvent) {
  const { sendDirectMessage } = useDirectMessage();

  const sendReminder = async (recipientPubkey: string, message: string) => {
    // Add event context to the reminder message
    const eventTitle = event.tags.find((tag) => tag[0] === "title")?.[1] || "Event";
    const contextualMessage = `📅 Event Reminder: ${eventTitle}\n\n${message}`;
    
    // Use the NIP-17 Direct Message system for reminders
    await sendDirectMessage(recipientPubkey, contextualMessage);
  };

  const sendBulkReminders = async (recipients: string[], message: string) => {
    // Send reminders to all recipients using NIP-17 DMs
    await Promise.all(
      recipients.map((recipient) => sendReminder(recipient, message))
    );
  };

  return {
    sendReminder,
    sendBulkReminders,
  };
}
