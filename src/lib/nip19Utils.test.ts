import { describe, it, expect } from 'vitest';
import { createEventIdentifier, decodeEventIdentifier, createEventUrl, isReplaceableEvent } from './nip19Utils';
import type { BaseEvent } from './eventTypes';

describe('nip19Utils', () => {
  const replaceableEvent: BaseEvent = {
    id: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    created_at: 1234567890,
    kind: 31922, // Date-based event (replaceable)
    content: 'Test event',
    tags: [['d', 'unique-identifier'], ['title', 'Test Event']],
  };

  const regularEvent: BaseEvent = {
    id: '9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    pubkey: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    created_at: 1234567890,
    kind: 1, // Regular note (not replaceable)
    content: 'Test note',
    tags: [],
  };

  describe('isReplaceableEvent', () => {
    it('identifies replaceable events correctly', () => {
      expect(isReplaceableEvent(31922)).toBe(true);
      expect(isReplaceableEvent(31923)).toBe(true);
      expect(isReplaceableEvent(30000)).toBe(true);
      expect(isReplaceableEvent(39999)).toBe(true);
      expect(isReplaceableEvent(1)).toBe(false);
      expect(isReplaceableEvent(7)).toBe(false);
      expect(isReplaceableEvent(40000)).toBe(false);
    });
  });

  describe('createEventIdentifier', () => {
    it('creates naddr for replaceable events', () => {
      const identifier = createEventIdentifier(replaceableEvent);
      expect(identifier).toMatch(/^naddr1/);
    });

    it('creates nevent for regular events', () => {
      const identifier = createEventIdentifier(regularEvent);
      expect(identifier).toMatch(/^nevent1/);
    });

    it('throws error when replaceable event is missing d tag', () => {
      const invalidEvent = { ...replaceableEvent, tags: [] };
      expect(() => createEventIdentifier(invalidEvent)).toThrow('Replaceable event missing d tag');
    });
  });

  describe('decodeEventIdentifier', () => {
    it('decodes naddr identifiers correctly', () => {
      const identifier = createEventIdentifier(replaceableEvent);
      const decoded = decodeEventIdentifier(identifier);
      
      expect(decoded.type).toBe('naddr');
      if (decoded.type === 'naddr') {
        expect(decoded.data.kind).toBe(31922);
        expect(decoded.data.pubkey).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
        expect(decoded.data.identifier).toBe('unique-identifier');
        expect(decoded.filter).toEqual({
          kinds: [31922],
          authors: ['abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'],
          '#d': ['unique-identifier'],
        });
      }
    });

    it('decodes nevent identifiers correctly', () => {
      const identifier = createEventIdentifier(regularEvent);
      const decoded = decodeEventIdentifier(identifier);
      
      expect(decoded.type).toBe('nevent');
      if (decoded.type === 'nevent') {
        expect(decoded.data.id).toBe('9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');
        expect(decoded.filter).toEqual({
          ids: ['9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba'],
        });
      }
    });

    it('handles raw event IDs', () => {
      const decoded = decodeEventIdentifier('event789');
      
      expect(decoded.type).toBe('raw');
      expect(decoded.data).toBe('event789');
      expect(decoded.filter).toEqual({
        ids: ['event789'],
      });
    });
  });

  describe('createEventUrl', () => {
    it('creates proper URLs with correct identifiers', () => {
      const replaceableUrl = createEventUrl(replaceableEvent, 'https://example.com');
      const regularUrl = createEventUrl(regularEvent, 'https://example.com');
      
      expect(replaceableUrl).toMatch(/^https:\/\/example\.com\/event\/naddr1/);
      expect(regularUrl).toMatch(/^https:\/\/example\.com\/event\/nevent1/);
    });
  });
});