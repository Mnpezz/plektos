import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MyTickets } from './MyTickets';

describe('MyTickets', () => {
  it('renders login prompt when user is not logged in', () => {
    render(
      <TestApp>
        <MyTickets />
      </TestApp>
    );

    expect(screen.getByText('My Tickets')).toBeInTheDocument();
    expect(screen.getByText('Please log in to view your event tickets and RSVPs.')).toBeInTheDocument();
  });
});