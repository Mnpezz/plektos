import { nip19 } from 'nostr-tools';
import type { BaseEvent } from './eventTypes';

/**
 * Determines if an event kind is replaceable (30000-39999)
 */
export function isReplaceableEvent(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

/**
 * Creates the appropriate NIP-19 identifier for an event
 * Uses naddr for replaceable events, nevent for regular events
 */
export function createEventIdentifier(event: BaseEvent, relays?: string[]): string {
  if (isReplaceableEvent(event.kind)) {
    const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
    if (!dTag) {
      throw new Error('Replaceable event missing d tag');
    }
    
    return nip19.naddrEncode({
      kind: event.kind,
      pubkey: event.pubkey,
      identifier: dTag,
      relays,
    });
  } else {
    return nip19.neventEncode({
      id: event.id,
      kind: event.kind,
      author: event.pubkey,
      relays,
    });
  }
}

/**
 * Decodes a NIP-19 identifier and returns the data needed to query for the event
 */
export function decodeEventIdentifier(identifier: string) {
  try {
    const decoded = nip19.decode(identifier);
    
    if (decoded.type === 'nevent') {
      return {
        type: 'nevent' as const,
        data: decoded.data,
        filter: { ids: [decoded.data.id] },
      };
    } else if (decoded.type === 'naddr') {
      return {
        type: 'naddr' as const,
        data: decoded.data,
        filter: {
          kinds: [decoded.data.kind],
          authors: [decoded.data.pubkey],
          '#d': [decoded.data.identifier],
        },
      };
    } else if (decoded.type === 'note') {
      return {
        type: 'note' as const,
        data: decoded.data,
        filter: { ids: [decoded.data] },
      };
    } else {
      throw new Error(`Unsupported identifier type: ${decoded.type}`);
    }
  } catch {
    // If it's not a NIP-19 identifier, assume it's a raw event ID
    return {
      type: 'raw' as const,
      data: identifier,
      filter: { ids: [identifier] },
    };
  }
}

/**
 * Creates a shareable URL for an event
 */
export function createEventUrl(event: BaseEvent, baseUrl: string = window.location.origin): string {
  const identifier = createEventIdentifier(event);
  return `${baseUrl}/event/${identifier}`;
}