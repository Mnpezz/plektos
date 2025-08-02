import type { DateBasedEvent, TimeBasedEvent, LiveEvent, RoomMeeting, InteractiveRoom } from './eventTypes';
import { createEventIdentifier } from './nip19Utils';

/**
 * Determines if an event is a live event based on NIP-53 or specific location URLs
 */
export function isLiveEvent(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): boolean {
  // NIP-53 live events (kind 30311), interactive rooms (kind 30312), and room meetings (kind 30313) are always live
  if (event.kind === 30311 || event.kind === 30312 || event.kind === 30313) {
    return true;
  }

  // For NIP-52 events, check if location contains specific URLs
  const location = event.tags.find((tag) => tag[0] === 'location')?.[1];
  if (location) {
    const normalizedLocation = location.toLowerCase();
    
    // Check for cornychat.com
    if (normalizedLocation.includes('cornychat.com')) {
      return true;
    }
    
    // Check for *.hivetalk.org domains
    if (normalizedLocation.includes('hivetalk.org')) {
      return true;
    }
  }

  return false;
}

/**
 * Determines if an event is an in-person event
 */
export function isInPersonEvent(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): boolean {
  // Live events are not in-person
  if (isLiveEvent(event)) {
    return false;
  }

  // Check if event has a physical location
  const location = event.tags.find((tag) => tag[0] === 'location')?.[1];
  const geohash = event.tags.find((tag) => tag[0] === 'g')?.[1];

  // If it has a geohash, it's definitely in-person
  if (geohash) {
    return true;
  }

  // If it has a location that doesn't look like a URL, it's likely in-person
  if (location && !isUrl(location)) {
    return true;
  }

  // Default to false if we can't determine
  return false;
}

/**
 * Helper function to check if a string looks like a URL
 */
function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the streaming URL for a live event
 */
export function getStreamingUrl(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): string | null {
  if (!isLiveEvent(event)) {
    return null;
  }

  // For NIP-53 events, check for streaming tag
  if (event.kind === 30311) {
    const streamingUrl = event.tags.find((tag) => tag[0] === 'streaming')?.[1];
    if (streamingUrl) {
      return streamingUrl;
    }
  }

  // For interactive rooms, check for service tag (room URL)
  if (event.kind === 30312) {
    const serviceUrl = event.tags.find((tag) => tag[0] === 'service')?.[1];
    if (serviceUrl) {
      return serviceUrl;
    }
  }

  // For room meetings, check for service tag (room URL) or platform-specific logic
  if (event.kind === 30313) {
    // Check for direct service URL first
    const serviceUrl = event.tags.find((tag) => tag[0] === 'service')?.[1];
    if (serviceUrl) {
      return serviceUrl;
    }
    
    // Check for platform-specific tags and generate appropriate URLs
    const platformTags = event.tags.filter(tag => tag[0] === "t").map(tag => tag[1]?.toLowerCase() || "");
    const relayTags = event.tags.filter(tag => tag[0] === "relays").map(tag => tag[1]?.toLowerCase() || "");
    const roomTag = event.tags.find(tag => tag[0] === "room")?.[1];
    
    // Check for hivetalk
    if (platformTags.includes("hivetalk") || relayTags.some(relay => relay.includes("hivetalk.org"))) {
      if (roomTag) {
        return `https://hivetalk.org/room/${roomTag}`;
      }
      return "https://hivetalk.org";
    }
    
    // For room meetings without direct URLs, we can't provide a streaming URL
    return null;
  }

  // For NIP-52 events with live locations, return the location
  const location = event.tags.find((tag) => tag[0] === 'location')?.[1];
  if (location && (location.toLowerCase().includes('cornychat.com') || location.toLowerCase().includes('hivetalk.org'))) {
    return location;
  }

  return null;
}

/**
 * Gets the live event status
 */
export function getLiveEventStatus(event: LiveEvent | RoomMeeting | InteractiveRoom): 'planned' | 'live' | 'ended' {
  const status = event.tags.find((tag) => tag[0] === 'status')?.[1];
  
  if (status === 'planned' || status === 'live' || status === 'ended') {
    return status;
  }

  // Default to planned if status is not set
  return 'planned';
}

/**
 * Type guard for LiveEvent
 */
export function isLiveEventType(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): event is LiveEvent {
  return event.kind === 30311;
}

/**
 * Gets the user-friendly viewing URL for a live event
 * For zap.stream events, returns zap.stream/naddr URL instead of raw m3u8
 * For other platforms, returns the original streaming URL
 */
export function getViewingUrl(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): string | null {
  const streamingUrl = getStreamingUrl(event);
  if (!streamingUrl) {
    return null;
  }

  // Check if this is a zap.stream event
  const isZapStream = streamingUrl.toLowerCase().includes('zap.stream') || 
                     event.tags.find(tag => tag[0] === 'service' && tag[1]?.toLowerCase().includes('zap.stream')) ||
                     event.tags.find(tag => tag[0] === 'location' && tag[1]?.toLowerCase().includes('zap.stream')) ||
                     event.content.toLowerCase().includes('zap.stream');

  if (isZapStream) {
    // Generate zap.stream/naddr URL
    const eventIdentifier = createEventIdentifier(event);
    return `https://zap.stream/${eventIdentifier}`;
  }

  // For other platforms, return the original streaming URL
  return streamingUrl;
}

/**
 * Type guard for RoomMeeting
 */
export function isRoomMeetingType(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): event is RoomMeeting {
  return event.kind === 30313;
}

/**
 * Type guard for InteractiveRoom
 */
export function isInteractiveRoomType(event: DateBasedEvent | TimeBasedEvent | LiveEvent | RoomMeeting | InteractiveRoom): event is InteractiveRoom {
  return event.kind === 30312;
}