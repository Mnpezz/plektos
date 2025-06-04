import type { DateBasedEvent, TimeBasedEvent } from "./eventTypes";
import { useNostrPublish } from "@/hooks/useNostrPublish";

export interface BlockedUser {
  pubkey: string;
  reason: string;
  timestamp: number;
}

export function useModeration(event: DateBasedEvent | TimeBasedEvent) {
  const { mutate: publishEvent } = useNostrPublish();

  const blockUser = async (pubkey: string, reason: string) => {
    // Create a block event (kind 10000)
    await publishEvent({
      kind: 10000,
      content: reason,
      tags: [
        ["e", event.id], // Reference to the event
        ["p", pubkey], // Blocked user's pubkey
      ],
    });
  };

  const unblockUser = async (pubkey: string) => {
    // Create an unblock event (kind 10001)
    await publishEvent({
      kind: 10001,
      content: "",
      tags: [
        ["e", event.id], // Reference to the event
        ["p", pubkey], // Unblocked user's pubkey
      ],
    });
  };

  return {
    blockUser,
    unblockUser,
  };
}
