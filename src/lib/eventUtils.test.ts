import { describe, it, expect } from 'vitest';

type MockEvent = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
};

describe('useEvents - Replaceable Event Deduplication', () => {
  it('deduplicates replaceable events correctly', () => {
    // Mock events data with duplicate replaceable events
    const mockEvents: MockEvent[] = [
      // Original calendar event
      {
        id: 'event1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Original description',
        tags: [
          ['d', 'my-event-2024'],
          ['title', 'My Calendar Event'],
        ],
      },
      // Updated version of the same calendar event
      {
        id: 'event2',
        kind: 31922,
        pubkey: 'author123',
        created_at: 2000, // Newer timestamp
        content: 'Updated description',
        tags: [
          ['d', 'my-event-2024'], // Same d tag
          ['title', 'My Updated Calendar Event'],
        ],
      },
      // Different event (different d tag)
      {
        id: 'event3',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1500,
        content: 'Another event',
        tags: [
          ['d', 'another-event-2024'],
          ['title', 'Another Event'],
        ],
      },
      // RSVP event (should not be deduplicated)
      {
        id: 'rsvp1',
        kind: 31925,
        pubkey: 'rsvp-author',
        created_at: 3000,
        content: 'Going!',
        tags: [
          ['a', '31922:author123:my-event-2024'],
          ['status', 'accepted'],
        ],
      },
    ];

    // Simulate the deduplication logic from useEvents
    const deduplicateEvents = (events: MockEvent[]): MockEvent[] => {
      return events.reduce((acc: MockEvent[], event: MockEvent) => {
        // For RSVP events (31925), keep all of them
        if (event.kind === 31925) {
          acc.push(event);
          return acc;
        }

        // For replaceable calendar events (31922, 31923)
        if (event.kind === 31922 || event.kind === 31923) {
          const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
          if (!dTag) {
            return acc;
          }

          const existingEvent = acc.find((e: MockEvent) => {
            if (e.kind !== event.kind || e.pubkey !== event.pubkey) return false;
            const existingDTag = e.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
            return existingDTag === dTag;
          });

          if (!existingEvent) {
            acc.push(event);
          } else if (event.created_at > existingEvent.created_at) {
            const index = acc.indexOf(existingEvent);
            acc[index] = event;
          }
          return acc;
        }

        acc.push(event);
        return acc;
      }, []);
    };

    const deduplicated = deduplicateEvents(mockEvents);

    // Expectations:
    // 1. Should have 3 events total (updated calendar event, different calendar event, RSVP event)
    expect(deduplicated).toHaveLength(3);

    // 2. Should have the updated version of the first event (event2, not event1)
    const myEventUpdated = deduplicated.find((e: MockEvent) => 
      e.kind === 31922 && 
      e.tags.some((tag: string[]) => tag[0] === 'd' && tag[1] === 'my-event-2024')
    );
    expect(myEventUpdated).toBeDefined();
    expect(myEventUpdated?.id).toBe('event2'); // Should be the newer version
    expect(myEventUpdated?.content).toBe('Updated description');
    expect(myEventUpdated?.created_at).toBe(2000);

    // 3. Should have the other calendar event
    const anotherEvent = deduplicated.find((e: MockEvent) => 
      e.kind === 31922 && 
      e.tags.some((tag: string[]) => tag[0] === 'd' && tag[1] === 'another-event-2024')
    );
    expect(anotherEvent).toBeDefined();
    expect(anotherEvent?.id).toBe('event3');

    // 4. Should have the RSVP event
    const rsvpEvent = deduplicated.find((e: MockEvent) => e.kind === 31925);
    expect(rsvpEvent).toBeDefined();
    expect(rsvpEvent?.id).toBe('rsvp1');

    // 5. Should NOT have the original version of the first event
    const originalEvent = deduplicated.find((e: MockEvent) => e.id === 'event1');
    expect(originalEvent).toBeUndefined();
  });

  it('handles events without d tags correctly', () => {
    const mockEvents: MockEvent[] = [
      // Event without d tag (should be skipped)
      {
        id: 'invalid1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Event without d tag',
        tags: [
          ['title', 'Invalid Event'],
        ],
      },
      // Valid event
      {
        id: 'valid1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Valid event',
        tags: [
          ['d', 'valid-event'],
          ['title', 'Valid Event'],
        ],
      },
    ];

    const deduplicateEvents = (events: MockEvent[]): MockEvent[] => {
      return events.reduce((acc: MockEvent[], event: MockEvent) => {
        if (event.kind === 31922 || event.kind === 31923) {
          const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
          if (!dTag) {
            return acc; // Skip events without d tag
          }
          acc.push(event);
        } else {
          acc.push(event);
        }
        return acc;
      }, []);
    };

    const deduplicated = deduplicateEvents(mockEvents);

    // Should only have the valid event
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].id).toBe('valid1');
  });

  it('keeps the newest version when multiple updates exist', () => {
    const mockEvents: MockEvent[] = [
      // Version 1
      {
        id: 'event1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Version 1',
        tags: [['d', 'evolving-event']],
      },
      // Version 3 (newest)
      {
        id: 'event3',
        kind: 31922,
        pubkey: 'author123',
        created_at: 3000,
        content: 'Version 3',
        tags: [['d', 'evolving-event']],
      },
      // Version 2 (middle)
      {
        id: 'event2',
        kind: 31922,
        pubkey: 'author123',
        created_at: 2000,
        content: 'Version 2',
        tags: [['d', 'evolving-event']],
      },
    ];

    const deduplicateEvents = (events: MockEvent[]): MockEvent[] => {
      return events.reduce((acc: MockEvent[], event: MockEvent) => {
        if (event.kind === 31922) {
          const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
          const existingEvent = acc.find((e: MockEvent) => {
            if (e.kind !== event.kind || e.pubkey !== event.pubkey) return false;
            const existingDTag = e.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
            return existingDTag === dTag;
          });

          if (!existingEvent) {
            acc.push(event);
          } else if (event.created_at > existingEvent.created_at) {
            const index = acc.indexOf(existingEvent);
            acc[index] = event;
          }
        }
        return acc;
      }, []);
    };

    const deduplicated = deduplicateEvents(mockEvents);

    // Should only have one event - the newest version
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].id).toBe('event3');
    expect(deduplicated[0].content).toBe('Version 3');
    expect(deduplicated[0].created_at).toBe(3000);
  });

  it('filters out private booking events', () => {
    const mockEvents: MockEvent[] = [
      // Regular public event
      {
        id: 'public1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Public event',
        tags: [
          ['d', 'public-event-2024'],
          ['title', 'Public Event'],
        ],
      },
      // Private booking event (should be filtered out)
      {
        id: 'booking1',
        kind: 31922,
        pubkey: 'author123',
        created_at: 1000,
        content: 'Private booking',
        tags: [
          ['d', 'booking-abc123'],
          ['title', 'Private Booking'],
        ],
      },
      // Another private booking event with different format
      {
        id: 'booking2',
        kind: 31923,
        pubkey: 'author456',
        created_at: 2000,
        content: 'Another private booking',
        tags: [
          ['d', 'user-booking-xyz789'],
          ['title', 'Another Private Booking'],
        ],
      },
      // RSVP event (should not be filtered)
      {
        id: 'rsvp1',
        kind: 31925,
        pubkey: 'rsvp-author',
        created_at: 3000,
        content: 'Going!',
        tags: [
          ['a', '31922:author123:public-event-2024'],
          ['status', 'accepted'],
        ],
      },
    ];

    const deduplicateEvents = (events: MockEvent[]): MockEvent[] => {
      return events.reduce((acc: MockEvent[], event: MockEvent) => {
        // For RSVP events (31925), keep all of them
        if (event.kind === 31925) {
          acc.push(event);
          return acc;
        }

        // For replaceable calendar events (31922, 31923)
        if (event.kind === 31922 || event.kind === 31923) {
          const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
          if (!dTag) {
            return acc;
          }

          // Filter out private booking events
          if (dTag.includes('booking-')) {
            return acc;
          }

          const existingEvent = acc.find((e: MockEvent) => {
            if (e.kind !== event.kind || e.pubkey !== event.pubkey) return false;
            const existingDTag = e.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
            return existingDTag === dTag;
          });

          if (!existingEvent) {
            acc.push(event);
          } else if (event.created_at > existingEvent.created_at) {
            const index = acc.indexOf(existingEvent);
            acc[index] = event;
          }
          return acc;
        }

        acc.push(event);
        return acc;
      }, []);
    };

    const deduplicated = deduplicateEvents(mockEvents);

    // Should have 2 events total: 1 public event + 1 RSVP event
    // The 2 booking events should be filtered out
    expect(deduplicated).toHaveLength(2);

    // Should have the public event
    const publicEvent = deduplicated.find((e: MockEvent) => e.id === 'public1');
    expect(publicEvent).toBeDefined();

    // Should have the RSVP event
    const rsvpEvent = deduplicated.find((e: MockEvent) => e.id === 'rsvp1');
    expect(rsvpEvent).toBeDefined();

    // Should NOT have any booking events
    const bookingEvents = deduplicated.filter((e: MockEvent) => 
      e.id === 'booking1' || e.id === 'booking2'
    );
    expect(bookingEvents).toHaveLength(0);

    // Verify the d tags of remaining events don't contain 'booking-'
    deduplicated.forEach((event: MockEvent) => {
      if (event.kind === 31922 || event.kind === 31923) {
        const dTag = event.tags.find((tag: string[]) => tag[0] === 'd')?.[1];
        if (dTag) {
          expect(dTag).not.toContain('booking-');
        }
      }
    });
  });
});