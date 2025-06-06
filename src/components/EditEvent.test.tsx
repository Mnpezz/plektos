import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { EditEvent } from './EditEvent';
import type { DateBasedEvent, TimeBasedEvent } from '@/lib/eventTypes';

// Mock event data
const mockDateBasedEvent: DateBasedEvent = {
  id: 'test-event-id',
  pubkey: 'test-pubkey',
  created_at: Math.floor(Date.now() / 1000),
  kind: 31922,
  tags: [
    ['d', 'test-event'],
    ['title', 'Test Event'],
    ['start', '2024-12-25'],
    ['end', '2024-12-25'],
    ['location', 'Test Location'],
  ],
  content: 'Test event description',
};

const mockTimeBasedEvent: TimeBasedEvent = {
  id: 'test-event-id-2',
  pubkey: 'test-pubkey',
  created_at: Math.floor(Date.now() / 1000),
  kind: 31923,
  tags: [
    ['d', 'test-time-event'],
    ['title', 'Test Time Event'],
    ['start', '1735142400'], // Unix timestamp
    ['end', '1735146000'], // Unix timestamp  
    ['location', 'Test Location'],
    ['start_tzid', 'UTC'],
  ],
  content: 'Test time-based event description',
};

describe('EditEvent', () => {
  it('does not render when user is not logged in', () => {
    render(
      <TestApp>
        <EditEvent event={mockDateBasedEvent} />
      </TestApp>
    );

    expect(screen.queryByText('Edit Event')).not.toBeInTheDocument();
  });

  it('does not render for unsupported event kinds', () => {
    const unsupportedEvent = {
      ...mockDateBasedEvent,
      kind: 1, // Regular text note, not a calendar event
    };

    render(
      <TestApp>
        <EditEvent event={unsupportedEvent as DateBasedEvent} />
      </TestApp>
    );

    expect(screen.queryByText('Edit Event')).not.toBeInTheDocument();
  });

  it('renders without errors for date-based events', () => {
    render(
      <TestApp>
        <EditEvent event={mockDateBasedEvent} />
      </TestApp>
    );

    // Component should render without throwing errors
    // Since we don't have a logged in user, the button won't appear
    expect(screen.queryByText('Edit Event')).not.toBeInTheDocument();
  });

  it('renders without errors for time-based events', () => {
    render(
      <TestApp>
        <EditEvent event={mockTimeBasedEvent} />
      </TestApp>
    );

    // Component should render without throwing errors
    // Since we don't have a logged in user, the button won't appear
    expect(screen.queryByText('Edit Event')).not.toBeInTheDocument();
  });
});