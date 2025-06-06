import { DateBasedEvent, TimeBasedEvent } from "@/lib/eventTypes";

/**
 * Event timezone detection and formatting utilities.
 * 
 * Supports timezone detection from multiple sources:
 * 1. NIP-52 timezone tags (start_tzid, end_tzid) - highest priority
 * 2. Other common timezone tags (tzid, timezone)
 * 3. Location-based timezone mapping - fallback
 * 
 * For kind 31923 (time-based) events, the following tags are checked in order:
 * - start_tzid: Official NIP-52 timezone for start time
 * - end_tzid: Official NIP-52 timezone for end time
 * - tzid: Generic timezone identifier
 * - timezone: Alternative timezone tag
 * 
 * Example usage:
 * Tags: [["start_tzid", "Europe/Madrid"], ["start", "1640995200"]]
 * Result: Event displayed in Madrid timezone (CET/CEST)
 */

// Common timezone mappings for major cities/regions
const TIMEZONE_MAP: Record<string, string> = {
  // US Cities
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'manhattan': 'America/New_York',
  'brooklyn': 'America/New_York',
  'chicago': 'America/Chicago',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'sf': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'denver': 'America/Denver',
  'phoenix': 'America/Phoenix',
  'miami': 'America/New_York',
  'atlanta': 'America/New_York',
  'dallas': 'America/Chicago',
  'houston': 'America/Chicago',
  'austin': 'America/Chicago',
  'las vegas': 'America/Los_Angeles',
  'portland': 'America/Los_Angeles',
  'boston': 'America/New_York',
  'washington': 'America/New_York',
  'dc': 'America/New_York',
  
  // International
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'amsterdam': 'Europe/Amsterdam',
  'rome': 'Europe/Rome',
  'madrid': 'Europe/Madrid',
  'barcelona': 'Europe/Madrid',
  'zurich': 'Europe/Zurich',
  'vienna': 'Europe/Vienna',
  'prague': 'Europe/Prague',
  'stockholm': 'Europe/Stockholm',
  'copenhagen': 'Europe/Copenhagen',
  'oslo': 'Europe/Oslo',
  'helsinki': 'Europe/Helsinki',
  'dublin': 'Europe/Dublin',
  'lisbon': 'Europe/Lisbon',
  'athens': 'Europe/Athens',
  'moscow': 'Europe/Moscow',
  'istanbul': 'Europe/Istanbul',
  'tokyo': 'Asia/Tokyo',
  'osaka': 'Asia/Tokyo',
  'seoul': 'Asia/Seoul',
  'beijing': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  'singapore': 'Asia/Singapore',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'brisbane': 'Australia/Brisbane',
  'perth': 'Australia/Perth',
  'auckland': 'Pacific/Auckland',
  'wellington': 'Pacific/Auckland',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'montreal': 'America/Montreal',
  'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'santiago': 'America/Santiago',
  'lima': 'America/Lima',
  'bogota': 'America/Bogota',
  'caracas': 'America/Caracas',
  'cape town': 'Africa/Johannesburg',
  'johannesburg': 'Africa/Johannesburg',
  'cairo': 'Africa/Cairo',
  'lagos': 'Africa/Lagos',
  'nairobi': 'Africa/Nairobi',
  'casablanca': 'Africa/Casablanca',
  
  // States/Regions
  'california': 'America/Los_Angeles',
  'texas': 'America/Chicago',
  'florida': 'America/New_York',
  'new york state': 'America/New_York',
  'illinois': 'America/Chicago',
  'washington state': 'America/Los_Angeles',
  'oregon': 'America/Los_Angeles',
  
  // Countries (use major city timezone)
  'usa': 'America/New_York',
  'united states': 'America/New_York',
  'uk': 'Europe/London',
  'united kingdom': 'Europe/London',
  'england': 'Europe/London',
  'france': 'Europe/Paris',
  'germany': 'Europe/Berlin',
  'italy': 'Europe/Rome',
  'spain': 'Europe/Madrid',
  'netherlands': 'Europe/Amsterdam',
  'switzerland': 'Europe/Zurich',
  'austria': 'Europe/Vienna',
  'belgium': 'Europe/Brussels',
  'sweden': 'Europe/Stockholm',
  'norway': 'Europe/Oslo',
  'denmark': 'Europe/Copenhagen',
  'finland': 'Europe/Helsinki',
  'ireland': 'Europe/Dublin',
  'portugal': 'Europe/Lisbon',
  'greece': 'Europe/Athens',
  'poland': 'Europe/Warsaw',
  'japan': 'Asia/Tokyo',
  'south korea': 'Asia/Seoul',
  'korea': 'Asia/Seoul',
  'china': 'Asia/Shanghai',
  'india': 'Asia/Kolkata',
  'australia': 'Australia/Sydney',
  'canada': 'America/Toronto',
  'mexico': 'America/Mexico_City',
  'brazil': 'America/Sao_Paulo',
  'argentina': 'America/Argentina/Buenos_Aires',
  'chile': 'America/Santiago',
  'peru': 'America/Lima',
  'colombia': 'America/Bogota',
  'venezuela': 'America/Caracas',
  'south africa': 'Africa/Johannesburg',
  'egypt': 'Africa/Cairo',
  'nigeria': 'Africa/Lagos',
  'kenya': 'Africa/Nairobi',
  'morocco': 'Africa/Casablanca',
};

/**
 * Validates if a timezone identifier is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Try to create a DateTimeFormat with the timezone
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to detect the timezone for an event based on timezone tags and location
 */
export function getEventTimezone(event: DateBasedEvent | TimeBasedEvent): string | null {
  // First, check for explicit timezone tags (NIP-52 and other standards)
  const startTzid = event.tags.find((tag) => tag[0] === "start_tzid")?.[1];
  if (startTzid && isValidTimezone(startTzid)) {
    console.debug(`Found start_tzid timezone: ${startTzid}`);
    return startTzid;
  }
  
  // For time-based events, also check for end_tzid as fallback
  if (event.kind === 31923) {
    const endTzid = event.tags.find((tag) => tag[0] === "end_tzid")?.[1];
    if (endTzid && isValidTimezone(endTzid)) {
      console.debug(`Found end_tzid timezone: ${endTzid}`);
      return endTzid;
    }
    
    // Check for other common timezone tags
    const tzid = event.tags.find((tag) => tag[0] === "tzid")?.[1];
    if (tzid && isValidTimezone(tzid)) {
      console.debug(`Found tzid timezone: ${tzid}`);
      return tzid;
    }
    
    const timezone = event.tags.find((tag) => tag[0] === "timezone")?.[1];
    if (timezone && isValidTimezone(timezone)) {
      console.debug(`Found timezone tag: ${timezone}`);
      return timezone;
    }
  }
  
  // Fallback to location-based timezone detection
  const location = event.tags.find((tag) => tag[0] === "location")?.[1];
  if (!location) {
    console.debug('No timezone tags or location found for event');
    return null;
  }
  
  const locationLower = location.toLowerCase().trim();
  
  // Try exact match first
  if (TIMEZONE_MAP[locationLower]) {
    console.debug(`Detected timezone from location "${location}": ${TIMEZONE_MAP[locationLower]}`);
    return TIMEZONE_MAP[locationLower];
  }
  
  // Try partial matches
  for (const [key, timezone] of Object.entries(TIMEZONE_MAP)) {
    if (locationLower.includes(key)) {
      console.debug(`Detected timezone from location "${location}" (partial match "${key}"): ${timezone}`);
      return timezone;
    }
  }
  
  console.debug(`Could not detect timezone for location: ${location}`);
  return null;
}

/**
 * Formats a date in the event's local timezone if detectable, otherwise uses browser timezone
 */
export function formatEventDateTime(
  timestamp: number,
  timezone: string | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = new Date(timestamp);
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  };
  
  if (timezone) {
    try {
      return date.toLocaleDateString(undefined, {
        ...formatOptions,
        timeZone: timezone,
      });
    } catch {
      console.warn(`Invalid timezone: ${timezone}, falling back to browser timezone`);
    }
  }
  
  // Fallback to browser timezone
  return date.toLocaleDateString(undefined, formatOptions);
}

/**
 * Formats a time in the event's local timezone if detectable, otherwise uses browser timezone
 */
export function formatEventTime(
  timestamp: number,
  timezone: string | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = new Date(timestamp);
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "numeric",
    ...options,
  };
  
  if (timezone) {
    try {
      return date.toLocaleTimeString(undefined, {
        ...formatOptions,
        timeZone: timezone,
      });
    } catch {
      console.warn(`Invalid timezone: ${timezone}, falling back to browser timezone`);
    }
  }
  
  // Fallback to browser timezone
  return date.toLocaleTimeString(undefined, formatOptions);
}

/**
 * Gets the timezone abbreviation for display (e.g., "PST", "EST", "CET")
 */
export function getTimezoneAbbreviation(timezone: string | null, timestamp: number = Date.now()): string {
  if (!timezone) return "";
  
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(new Date(timestamp));
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? ` ${timeZonePart.value}` : "";
  } catch {
    console.warn(`Could not get timezone abbreviation for: ${timezone}`);
    return "";
  }
}