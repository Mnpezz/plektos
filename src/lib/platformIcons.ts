import type { DateBasedEvent, TimeBasedEvent, LiveEvent, RoomMeeting, InteractiveRoom } from "@/lib/eventTypes";

export interface PlatformIcon {
  icon: string;
  name: string;
  color?: string;
}

/**
 * Get platform-specific icon for live events based on stream URL or location
 * Supports both NIP-52 (31922, 31923) and NIP-53 (30311, 30312, 30313) events
 */
export function getPlatformIcon(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): PlatformIcon | null {
  // Get stream URL from service tag (for InteractiveRoom) or streaming tag
  const serviceUrl = event.tags.find(tag => tag[0] === "service")?.[1];
  const streamingUrl = event.tags.find(tag => tag[0] === "streaming")?.[1];
  const locationTag = event.tags.find(tag => tag[0] === "location")?.[1];
  
  // Get platform tags (t tags) for additional platform detection
  const platformTags = event.tags
    .filter(tag => tag[0] === "t")
    .map(tag => tag[1]?.toLowerCase() || "");
  
  // Get relays for additional platform hints
  const relayTags = event.tags
    .filter(tag => tag[0] === "relays")
    .map(tag => tag[1]?.toLowerCase() || "");
  
  // Combine all possible URLs/locations/tags to check
  const urlsToCheck = [serviceUrl, streamingUrl, locationTag, event.content, ...platformTags, ...relayTags]
    .filter(Boolean)
    .map(url => url?.toLowerCase() || "");

  const allText = urlsToCheck.join(" ");

  // Check for specific platforms
  if (allText.includes("hivetalk.org")) {
    return {
      icon: "🐝",
      name: "Hivetalk",
      color: "#F59E0B", // amber
    };
  }

  if (allText.includes("nostrnests.com")) {
    return {
      icon: "🪺",
      name: "Nostr Nests",
      color: "#8B5CF6", // violet
    };
  }

  if (allText.includes("zap.stream")) {
    return {
      icon: "⚡",
      name: "Zap Stream",
      color: "#EAB308", // yellow
    };
  }

  if (allText.includes("cornychat.com")) {
    return {
      icon: "🌽",
      name: "Corny Chat",
      color: "#F59E0B", // amber
    };
  }

  return null;
}

/**
 * Check if an event is a live event type that can have platform icons
 * Includes both NIP-52 calendar events (31922, 31923) and NIP-53 live events (30311, 30312, 30313)
 */
export function isLiveEventType(event: { kind: number }): event is DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom {
  return event.kind === 31922 || event.kind === 31923 || event.kind === 30311 || event.kind === 30312 || event.kind === 30313;
}