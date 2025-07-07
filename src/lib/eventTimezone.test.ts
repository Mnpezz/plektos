import { describe, it, expect } from 'vitest';
import { createTimestampInTimezone, formatEventDateTime, getTimezoneAbbreviation } from './eventTimezone';

describe('Timezone Handling', () => {
  it('should create correct timestamp for EDT timezone', () => {
    // Test case: 3:00 PM EDT on a specific date
    const dateString = '2025-07-15'; // July 15, 2025 (during EDT)
    const timeString = '15:00'; // 3:00 PM
    const timezone = 'America/New_York';
    
    const timestamp = createTimestampInTimezone(dateString, timeString, timezone);
    
    // Convert back to verify
    const formattedTime = formatEventDateTime(timestamp * 1000, timezone, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    // The formatted time should show 15:00 (3:00 PM) in EDT
    expect(formattedTime).toContain('15:00');
    
    // Verify timezone abbreviation
    const abbr = getTimezoneAbbreviation(timezone, timestamp * 1000);
    expect(abbr).toBe('EDT'); // Should be EDT in July
  });

  it('should create correct timestamp for EST timezone', () => {
    // Test case: 3:00 PM EST on a specific date
    const dateString = '2025-01-15'; // January 15, 2025 (during EST)
    const timeString = '15:00'; // 3:00 PM
    const timezone = 'America/New_York';
    
    const timestamp = createTimestampInTimezone(dateString, timeString, timezone);
    
    // Convert back to verify
    const formattedTime = formatEventDateTime(timestamp * 1000, timezone, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    // The formatted time should show 15:00 (3:00 PM) in EST
    expect(formattedTime).toContain('15:00');
    
    // Verify timezone abbreviation
    const abbr = getTimezoneAbbreviation(timezone, timestamp * 1000);
    expect(abbr).toBe('EST'); // Should be EST in January
  });

  it('should handle different timezones correctly', () => {
    const dateString = '2025-07-15';
    const timeString = '15:00';
    
    // Test multiple timezones
    const timezones = [
      'America/New_York',
      'America/Los_Angeles', 
      'Europe/London',
      'Asia/Tokyo'
    ];
    
    timezones.forEach(timezone => {
      const timestamp = createTimestampInTimezone(dateString, timeString, timezone);
      const formattedTime = formatEventDateTime(timestamp * 1000, timezone, {
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      
      // Each should show 15:00 in their respective timezone
      expect(formattedTime).toContain('15:00');
    });
  });

  it('should handle edge cases', () => {
    // Test midnight
    const timestamp1 = createTimestampInTimezone('2025-07-15', '00:00', 'America/New_York');
    const formatted1 = formatEventDateTime(timestamp1 * 1000, 'America/New_York', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    expect(formatted1).toContain('00:00');

    // Test noon
    const timestamp2 = createTimestampInTimezone('2025-07-15', '12:00', 'America/New_York');
    const formatted2 = formatEventDateTime(timestamp2 * 1000, 'America/New_York', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    expect(formatted2).toContain('12:00');

    // Test late evening
    const timestamp3 = createTimestampInTimezone('2025-07-15', '23:30', 'America/New_York');
    const formatted3 = formatEventDateTime(timestamp3 * 1000, 'America/New_York', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    expect(formatted3).toContain('23:30');
  });

  it('should correctly handle the reported timestamp issue', () => {
    // Test the specific timestamp mentioned: 1751986800
    // This should represent 3:00 PM EDT, not 11:00 AM EDT
    const timestamp = 1751986800;
    const timezone = 'America/New_York';
    
    // Convert the timestamp to see what time it actually represents
    const formattedTime = formatEventDateTime(timestamp * 1000, timezone, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    // Let's also check what date this represents
    const formattedDate = formatEventDateTime(timestamp * 1000, timezone, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    console.log(`Timestamp ${timestamp} in ${timezone}:`);
    console.log(`Date: ${formattedDate}`);
    console.log(`Time: ${formattedTime}`);
    
    // Now let's test creating a timestamp for 3:00 PM EDT on the same date
    // First, let's figure out what date this timestamp represents
    const date = new Date(timestamp * 1000);
    const dateInEDT = date.toLocaleDateString('en-CA', { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Create a new timestamp for 3:00 PM on that date
    const correctTimestamp = createTimestampInTimezone(dateInEDT, '15:00', timezone);
    const correctFormattedTime = formatEventDateTime(correctTimestamp * 1000, timezone, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    console.log(`Correct timestamp for 3:00 PM EDT on ${dateInEDT}: ${correctTimestamp}`);
    console.log(`Formatted time: ${correctFormattedTime}`);
    
    // The correct timestamp should show 15:00 (3:00 PM)
    expect(correctFormattedTime).toContain('15:00');
  });
});