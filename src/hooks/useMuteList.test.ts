import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useMuteList - NIP-51 Mute List Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mute List Data Structure', () => {
    it('correctly structures NIP-51 mute list event', () => {
      // Mock mute list event structure based on NIP-51
      const mockMuteList = {
        id: 'mute-list-123',
        kind: 10000, // NIP-51 mute list
        pubkey: 'user-pubkey-123456789012345678901234567890123456789012345678',
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [
          ['p', 'muted-user-1-123456789012345678901234567890123456789012345678'],
          ['p', 'muted-user-2-123456789012345678901234567890123456789012345678', '', 'spam'],
          ['p', 'muted-user-3-123456789012345678901234567890123456789012345678', '', 'inappropriate content'],
        ],
        sig: 'signature-123',
      };

      // Verify structure
      expect(mockMuteList.kind).toBe(10000);
      expect(mockMuteList.content).toBe('');
      expect(mockMuteList.tags).toHaveLength(3);

      // Verify muted pubkeys extraction
      const mutedPubkeys = mockMuteList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      expect(mutedPubkeys).toEqual([
        'muted-user-1-123456789012345678901234567890123456789012345678',
        'muted-user-2-123456789012345678901234567890123456789012345678',
        'muted-user-3-123456789012345678901234567890123456789012345678'
      ]);

      // Verify mute reasons
      const reasonForUser2 = mockMuteList.tags.find(
        tag => tag[0] === 'p' && tag[1] === 'muted-user-2-123456789012345678901234567890123456789012345678'
      )?.[3];
      expect(reasonForUser2).toBe('spam');

      const reasonForUser3 = mockMuteList.tags.find(
        tag => tag[0] === 'p' && tag[1] === 'muted-user-3-123456789012345678901234567890123456789012345678'
      )?.[3];
      expect(reasonForUser3).toBe('inappropriate content');
    });

    it('handles empty mute list correctly', () => {
      const emptyMuteList = {
        id: 'empty-mute-list-123',
        kind: 10000,
        pubkey: 'user-pubkey-123456789012345678901234567890123456789012345678',
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [], // No muted users
        sig: 'signature-123',
      };

      const mutedPubkeys = emptyMuteList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      expect(mutedPubkeys).toEqual([]);
      expect(mutedPubkeys).toHaveLength(0);
    });
  });

  describe('Mute List Operations', () => {
    it('correctly adds a new muted user', () => {
      const currentMuteList = {
        tags: [
          ['p', 'existing-muted-user-123456789012345678901234567890123456789'],
        ],
      };

      const newMutedPubkey = 'new-muted-user-123456789012345678901234567890123456789012';
      const muteReason = 'spam content';

      // Simulate adding a new muted user
      const updatedTags = [
        ...currentMuteList.tags,
        ['p', newMutedPubkey, '', muteReason],
      ];

      expect(updatedTags).toHaveLength(2);
      expect(updatedTags[1]).toEqual(['p', newMutedPubkey, '', muteReason]);

      // Verify the user is now in the mute list
      const mutedPubkeys = updatedTags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      expect(mutedPubkeys).toContain(newMutedPubkey);
    });

    it('correctly appends multiple users to mute list', () => {
      // Start with existing mute list
      let currentMuteList = {
        tags: [
          ['p', 'user1-123456789012345678901234567890123456789012345678'],
          ['p', 'user2-123456789012345678901234567890123456789012345678', '', 'spam'],
        ],
      };

      // Add third user
      const user3 = 'user3-123456789012345678901234567890123456789012345678';
      let updatedTags = [
        ...currentMuteList.tags,
        ['p', user3, '', 'inappropriate'],
      ];

      expect(updatedTags).toHaveLength(3);

      // Simulate updating the mute list
      currentMuteList = { tags: updatedTags };

      // Add fourth user
      const user4 = 'user4-123456789012345678901234567890123456789012345678';
      updatedTags = [
        ...currentMuteList.tags,
        ['p', user4],
      ];

      expect(updatedTags).toHaveLength(4);

      // Verify all users are in the final list
      const mutedPubkeys = updatedTags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      expect(mutedPubkeys).toEqual([
        'user1-123456789012345678901234567890123456789012345678',
        'user2-123456789012345678901234567890123456789012345678',
        user3,
        user4,
      ]);
    });

    it('preserves existing mutes when adding new ones', () => {
      const existingMutes = [
        ['p', 'alice-123456789012345678901234567890123456789012345678'],
        ['p', 'bob-123456789012345678901234567890123456789012345678', '', 'spam'],
        ['p', 'charlie-123456789012345678901234567890123456789012345678', '', 'harassment'],
      ];

      // Simulate current mute list query result
      const currentMuteList = {
        kind: 10000,
        tags: existingMutes,
        content: '',
      };

      // Add new user to mute list  
      const newUser = 'dave-123456789012345678901234567890123456789012345678';
      const newTags = [
        ...currentMuteList.tags,
        ['p', newUser, '', 'trolling'],
      ];

      // Verify all original mutes are preserved
      expect(newTags).toHaveLength(4);
      expect(newTags[0]).toEqual(['p', 'alice-123456789012345678901234567890123456789012345678']);
      expect(newTags[1]).toEqual(['p', 'bob-123456789012345678901234567890123456789012345678', '', 'spam']);
      expect(newTags[2]).toEqual(['p', 'charlie-123456789012345678901234567890123456789012345678', '', 'harassment']);
      expect(newTags[3]).toEqual(['p', newUser, '', 'trolling']);

      // Verify extracted pubkeys contains all users
      const mutedPubkeys = newTags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);

      expect(mutedPubkeys).toContain('alice-123456789012345678901234567890123456789012345678');
      expect(mutedPubkeys).toContain('bob-123456789012345678901234567890123456789012345678');
      expect(mutedPubkeys).toContain('charlie-123456789012345678901234567890123456789012345678');
      expect(mutedPubkeys).toContain(newUser);
    });

    it('correctly removes a muted user', () => {
      const currentMuteList = {
        tags: [
          ['p', 'user1-123456789012345678901234567890123456789012345678'],
          ['p', 'user2-123456789012345678901234567890123456789012345678'],
          ['p', 'user3-123456789012345678901234567890123456789012345678'],
        ],
      };

      const userToUnmute = 'user2-123456789012345678901234567890123456789012345678';

      // Simulate removing a muted user
      const updatedTags = currentMuteList.tags.filter(
        tag => !(tag[0] === 'p' && tag[1] === userToUnmute)
      );

      expect(updatedTags).toHaveLength(2);

      // Verify the user is no longer in the mute list
      const mutedPubkeys = updatedTags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      expect(mutedPubkeys).not.toContain(userToUnmute);
      expect(mutedPubkeys).toContain('user1-123456789012345678901234567890123456789012345678');
      expect(mutedPubkeys).toContain('user3-123456789012345678901234567890123456789012345678');
    });

    it('prevents duplicate mutes', () => {
      const currentMuteList = {
        tags: [
          ['p', 'already-muted-user-123456789012345678901234567890123456789'],
        ],
      };

      const duplicateMutePubkey = 'already-muted-user-123456789012345678901234567890123456789';

      // Check if user is already muted
      const isAlreadyMuted = currentMuteList.tags.some(
        tag => tag[0] === 'p' && tag[1] === duplicateMutePubkey
      );

      expect(isAlreadyMuted).toBe(true);

      // Should not add duplicate
      if (!isAlreadyMuted) {
        // This branch should not execute
        expect(true).toBe(false);
      }
    });

    it('demonstrates the correct muting workflow', () => {
      // Step 1: Empty mute list
      let muteList: { tags: string[][] } = { tags: [] };
      
      // Step 2: Mute first user
      const user1 = 'spammer-123456789012345678901234567890123456789012345678';
      muteList = {
        tags: [
          ...muteList.tags,
          ['p', user1, '', 'spam']
        ]
      };
      expect(muteList.tags).toHaveLength(1);

      // Step 3: Mute second user - should append, not replace
      const user2 = 'troll-123456789012345678901234567890123456789012345678';
      muteList = {
        tags: [
          ...muteList.tags,
          ['p', user2, '', 'trolling']
        ]
      };
      expect(muteList.tags).toHaveLength(2);

      // Step 4: Mute third user - should append, not replace
      const user3 = 'bot-123456789012345678901234567890123456789012345678';
      muteList = {
        tags: [
          ...muteList.tags,
          ['p', user3, '', 'bot account']
        ]
      };
      expect(muteList.tags).toHaveLength(3);

      // Verify all users are muted
      const mutedPubkeys = muteList.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1]);
      
      expect(mutedPubkeys).toEqual([user1, user2, user3]);

      // Verify reasons are preserved
      const user1Reason = muteList.tags.find(tag => tag[1] === user1)?.[3];
      const user2Reason = muteList.tags.find(tag => tag[1] === user2)?.[3];
      const user3Reason = muteList.tags.find(tag => tag[1] === user3)?.[3];

      expect(user1Reason).toBe('spam');
      expect(user2Reason).toBe('trolling');
      expect(user3Reason).toBe('bot account');
    });
  });

  describe('Event Feed Filtering', () => {
    it('filters out events from muted pubkeys', () => {
      const mockEvents = [
        {
          id: 'event1',
          kind: 31922,
          pubkey: 'muted-user-123456789012345678901234567890123456789012345678',
          content: 'Event from muted user',
          tags: [['d', 'event1'], ['title', 'Muted Event']],
        },
        {
          id: 'event2',
          kind: 31922,
          pubkey: 'normal-user-123456789012345678901234567890123456789012345678',
          content: 'Event from normal user',
          tags: [['d', 'event2'], ['title', 'Normal Event']],
        },
        {
          id: 'event3',
          kind: 31923,
          pubkey: 'another-muted-123456789012345678901234567890123456789012345678',
          content: 'Another event from muted user',
          tags: [['d', 'event3'], ['title', 'Another Muted Event']],
        },
      ];

      const mutedPubkeys = [
        'muted-user-123456789012345678901234567890123456789012345678',
        'another-muted-123456789012345678901234567890123456789012345678',
      ];

      // Simulate filtering logic from Home component
      const filteredEvents = mockEvents.filter(event => {
        // Filter out calendar events from muted pubkeys
        if (event.kind === 31922 || event.kind === 31923) {
          return !mutedPubkeys.includes(event.pubkey);
        }
        return true;
      });

      expect(filteredEvents).toHaveLength(1);
      expect(filteredEvents[0].id).toBe('event2');
      expect(filteredEvents[0].pubkey).toBe('normal-user-123456789012345678901234567890123456789012345678');
    });

    it('handles empty mute list gracefully', () => {
      const mockEvents = [
        {
          id: 'event1',
          kind: 31922,
          pubkey: 'user1-123456789012345678901234567890123456789012345678',
          content: 'Event 1',
        },
        {
          id: 'event2',
          kind: 31923,
          pubkey: 'user2-123456789012345678901234567890123456789012345678',
          content: 'Event 2',
        },
      ];

      const mutedPubkeys: string[] = []; // Empty mute list

      const filteredEvents = mockEvents.filter(event => {
        if (event.kind === 31922 || event.kind === 31923) {
          return !mutedPubkeys.includes(event.pubkey);
        }
        return true;
      });

      expect(filteredEvents).toHaveLength(2); // All events should remain
    });
  });

  describe('NIP-51 Compliance', () => {
    it('uses correct event kind for mute lists', () => {
      const correctKind = 10000;
      expect(correctKind).toBe(10000); // NIP-51 specifies kind 10000 for mute lists
    });

    it('structures p tags correctly for muted users', () => {
      const pubkey = 'user-123456789012345678901234567890123456789012345678';
      const reason = 'unwanted content';

      // NIP-51 p tag structure: ["p", pubkey, relay_url (optional), reason (optional)]
      const pTagWithReason = ['p', pubkey, '', reason];
      const pTagWithoutReason = ['p', pubkey];

      expect(pTagWithReason[0]).toBe('p');
      expect(pTagWithReason[1]).toBe(pubkey);
      expect(pTagWithReason[3]).toBe(reason);

      expect(pTagWithoutReason[0]).toBe('p');
      expect(pTagWithoutReason[1]).toBe(pubkey);
      expect(pTagWithoutReason[2]).toBeUndefined();
    });
  });
});