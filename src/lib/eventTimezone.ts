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

// Comprehensive list of timezones organized by region
export const TIMEZONES = {
  // North America
  "America/New_York": "Eastern Time (ET)",
  "America/Chicago": "Central Time (CT)",
  "America/Denver": "Mountain Time (MT)",
  "America/Phoenix": "Mountain Time - Arizona (MT)",
  "America/Los_Angeles": "Pacific Time (PT)",
  "America/Anchorage": "Alaska Time (AKT)",
  "Pacific/Honolulu": "Hawaii Time (HT)",
  "America/Toronto": "Eastern Time - Toronto",
  "America/Vancouver": "Pacific Time - Vancouver",
  "America/Montreal": "Eastern Time - Montreal",
  "America/Edmonton": "Mountain Time - Edmonton",
  "America/Winnipeg": "Central Time - Winnipeg",
  "America/Halifax": "Atlantic Time - Halifax",
  "America/St_Johns": "Newfoundland Time",
  "America/Mexico_City": "Central Time - Mexico",
  "America/Tijuana": "Pacific Time - Tijuana",
  "America/Guatemala": "Central Time - Guatemala",
  "America/El_Salvador": "Central Time - El Salvador",
  "America/Managua": "Central Time - Nicaragua",
  "America/Costa_Rica": "Central Time - Costa Rica",
  "America/Panama": "Eastern Time - Panama",
  "America/Bogota": "Colombia Time",
  "America/Lima": "Peru Time",
  "America/Caracas": "Venezuela Time",
  "America/La_Paz": "Bolivia Time",
  "America/Santiago": "Chile Time",
  "America/Asuncion": "Paraguay Time",
  "America/Montevideo": "Uruguay Time",
  "America/Argentina/Buenos_Aires": "Argentina Time",
  "America/Sao_Paulo": "Brazil Time",
  "America/Cayenne": "French Guiana Time",
  "America/Paramaribo": "Suriname Time",
  "America/Guyana": "Guyana Time",

  // Europe
  "Europe/London": "Greenwich Mean Time (GMT)",
  "Europe/Paris": "Central European Time (CET)",
  "Europe/Berlin": "Central European Time (CET)",
  "Europe/Rome": "Central European Time (CET)",
  "Europe/Madrid": "Central European Time (CET)",
  "Europe/Amsterdam": "Central European Time (CET)",
  "Europe/Brussels": "Central European Time (CET)",
  "Europe/Vienna": "Central European Time (CET)",
  "Europe/Zurich": "Central European Time (CET)",
  "Europe/Prague": "Central European Time (CET)",
  "Europe/Warsaw": "Central European Time (CET)",
  "Europe/Budapest": "Central European Time (CET)",
  "Europe/Bratislava": "Central European Time (CET)",
  "Europe/Ljubljana": "Central European Time (CET)",
  "Europe/Zagreb": "Central European Time (CET)",
  "Europe/Belgrade": "Central European Time (CET)",
  "Europe/Sofia": "Eastern European Time (EET)",
  "Europe/Bucharest": "Eastern European Time (EET)",
  "Europe/Athens": "Eastern European Time (EET)",
  "Europe/Istanbul": "Turkey Time",
  "Europe/Moscow": "Moscow Time",
  "Europe/Kiev": "Eastern European Time (EET)",
  "Europe/Minsk": "Moscow Time",
  "Europe/Riga": "Eastern European Time (EET)",
  "Europe/Tallinn": "Eastern European Time (EET)",
  "Europe/Vilnius": "Eastern European Time (EET)",
  "Europe/Helsinki": "Eastern European Time (EET)",
  "Europe/Stockholm": "Central European Time (CET)",
  "Europe/Oslo": "Central European Time (CET)",
  "Europe/Copenhagen": "Central European Time (CET)",
  "Europe/Dublin": "Greenwich Mean Time (GMT)",
  "Europe/Lisbon": "Western European Time (WET)",
  "Europe/Reykjavik": "Greenwich Mean Time (GMT)",

  // Asia
  "Asia/Tokyo": "Japan Standard Time (JST)",
  "Asia/Seoul": "Korea Standard Time (KST)",
  "Asia/Shanghai": "China Standard Time (CST)",
  "Asia/Beijing": "China Standard Time (CST)",
  "Asia/Hong_Kong": "Hong Kong Time (HKT)",
  "Asia/Singapore": "Singapore Time (SGT)",
  "Asia/Bangkok": "Indochina Time (ICT)",
  "Asia/Ho_Chi_Minh": "Indochina Time (ICT)",
  "Asia/Manila": "Philippine Time (PHT)",
  "Asia/Jakarta": "Western Indonesian Time (WIB)",
  "Asia/Makassar": "Central Indonesian Time (WITA)",
  "Asia/Jayapura": "Eastern Indonesian Time (WIT)",
  "Asia/Kuala_Lumpur": "Malaysia Time (MYT)",
  "Asia/Yangon": "Myanmar Time (MMT)",
  "Asia/Dhaka": "Bangladesh Standard Time (BST)",
  "Asia/Kolkata": "India Standard Time (IST)",
  "Asia/Kathmandu": "Nepal Time (NPT)",
  "Asia/Colombo": "Sri Lanka Time (SLT)",
  "Asia/Karachi": "Pakistan Standard Time (PKT)",
  "Asia/Tashkent": "Uzbekistan Time (UZT)",
  "Asia/Almaty": "Kazakhstan Time (ALMT)",
  "Asia/Bishkek": "Kyrgyzstan Time (KGT)",
  "Asia/Dushanbe": "Tajikistan Time (TJT)",
  "Asia/Ashgabat": "Turkmenistan Time (TMT)",
  "Asia/Baku": "Azerbaijan Time (AZT)",
  "Asia/Tbilisi": "Georgia Time (GET)",
  "Asia/Yerevan": "Armenia Time (AMT)",
  "Asia/Tehran": "Iran Standard Time (IRST)",
  "Asia/Dubai": "Gulf Standard Time (GST)",
  "Asia/Muscat": "Gulf Standard Time (GST)",
  "Asia/Qatar": "Arabia Standard Time (AST)",
  "Asia/Kuwait": "Arabia Standard Time (AST)",
  "Asia/Riyadh": "Arabia Standard Time (AST)",
  "Asia/Baghdad": "Arabia Standard Time (AST)",
  "Asia/Amman": "Arabia Standard Time (AST)",
  "Asia/Beirut": "Arabia Standard Time (AST)",
  "Asia/Damascus": "Arabia Standard Time (AST)",
  "Asia/Jerusalem": "Israel Standard Time (IST)",
  "Asia/Gaza": "Palestine Time (PSE)",
  "Asia/Hebron": "Palestine Time (PSE)",

  // Africa
  "Africa/Cairo": "Eastern European Time (EET)",
  "Africa/Johannesburg": "South Africa Standard Time (SAST)",
  "Africa/Lagos": "West Africa Time (WAT)",
  "Africa/Nairobi": "East Africa Time (EAT)",
  "Africa/Casablanca": "Western European Time (WET)",
  "Africa/Algiers": "Central European Time (CET)",
  "Africa/Tunis": "Central European Time (CET)",
  "Africa/Tripoli": "Eastern European Time (EET)",
  "Africa/Khartoum": "Central Africa Time (CAT)",
  "Africa/Addis_Ababa": "East Africa Time (EAT)",
  "Africa/Dar_es_Salaam": "East Africa Time (EAT)",
  "Africa/Kampala": "East Africa Time (EAT)",
  "Africa/Kinshasa": "West Africa Time (WAT)",
  "Africa/Luanda": "West Africa Time (WAT)",
  "Africa/Brazzaville": "West Africa Time (WAT)",
  "Africa/Libreville": "West Africa Time (WAT)",
  "Africa/Douala": "West Africa Time (WAT)",
  "Africa/Malabo": "West Africa Time (WAT)",
  "Africa/Bangui": "West Africa Time (WAT)",
  "Africa/Ndjamena": "West Africa Time (WAT)",
  "Africa/Banjul": "Greenwich Mean Time (GMT)",
  "Africa/Dakar": "Greenwich Mean Time (GMT)",
  "Africa/Conakry": "Greenwich Mean Time (GMT)",
  "Africa/Bissau": "Greenwich Mean Time (GMT)",
  "Africa/Freetown": "Greenwich Mean Time (GMT)",
  "Africa/Monrovia": "Greenwich Mean Time (GMT)",
  "Africa/Accra": "Greenwich Mean Time (GMT)",
  "Africa/Lome": "Greenwich Mean Time (GMT)",
  "Africa/Porto-Novo": "West Africa Time (WAT)",
  "Africa/Niamey": "West Africa Time (WAT)",
  "Africa/Ouagadougou": "Greenwich Mean Time (GMT)",
  "Africa/Abidjan": "Greenwich Mean Time (GMT)",
  "Africa/Bamako": "Greenwich Mean Time (GMT)",
  "Africa/Nouakchott": "Greenwich Mean Time (GMT)",
  "Africa/El_Aaiun": "Western European Time (WET)",

  // Oceania
  "Australia/Sydney": "Australian Eastern Time (AET)",
  "Australia/Melbourne": "Australian Eastern Time (AET)",
  "Australia/Brisbane": "Australian Eastern Time (AET)",
  "Australia/Perth": "Australian Western Time (AWT)",
  "Australia/Adelaide": "Australian Central Time (ACT)",
  "Australia/Darwin": "Australian Central Time (ACT)",
  "Australia/Hobart": "Australian Eastern Time (AET)",
  "Pacific/Auckland": "New Zealand Standard Time (NZST)",
  "Pacific/Wellington": "New Zealand Standard Time (NZST)",
  "Pacific/Fiji": "Fiji Time (FJT)",
  "Pacific/Guam": "Chamorro Standard Time (ChST)",
  "Pacific/Saipan": "Chamorro Standard Time (ChST)",
  "Pacific/Port_Moresby": "Papua New Guinea Time (PGT)",
  "Pacific/Honiara": "Solomon Islands Time (SBT)",
  "Pacific/Noumea": "New Caledonia Time (NCT)",
  "Pacific/Vanuatu": "Vanuatu Time (VUT)",
  "Pacific/Tarawa": "Gilbert Islands Time (GILT)",
  "Pacific/Majuro": "Marshall Islands Time (MHT)",
  "Pacific/Palau": "Palau Time (PWT)",
  "Pacific/Chuuk": "Chuuk Time (CHUT)",
  "Pacific/Pohnpei": "Pohnpei Time (PONT)",
  "Pacific/Kosrae": "Kosrae Time (KOST)",
  "Pacific/Nauru": "Nauru Time (NRT)",
  "Pacific/Kiribati": "Phoenix Islands Time (PHOT)",
  "Pacific/Tahiti": "Tahiti Time (TAHT)",
  "Pacific/Marquesas": "Marquesas Time (MART)",
  "Pacific/Gambier": "Gambier Time (GAMT)",
  "Pacific/Easter": "Easter Island Time (EAST)",

  // UTC and other
  UTC: "Coordinated Universal Time (UTC)",
  GMT: "Greenwich Mean Time (GMT)",
  "Etc/UTC": "Coordinated Universal Time (UTC)",
  "Etc/GMT": "Greenwich Mean Time (GMT)",
  "Etc/GMT+1": "GMT-1",
  "Etc/GMT+2": "GMT-2",
  "Etc/GMT+3": "GMT-3",
  "Etc/GMT+4": "GMT-4",
  "Etc/GMT+5": "GMT-5",
  "Etc/GMT+6": "GMT-6",
  "Etc/GMT+7": "GMT-7",
  "Etc/GMT+8": "GMT-8",
  "Etc/GMT+9": "GMT-9",
  "Etc/GMT+10": "GMT-10",
  "Etc/GMT+11": "GMT-11",
  "Etc/GMT+12": "GMT-12",
  "Etc/GMT-1": "GMT+1",
  "Etc/GMT-2": "GMT+2",
  "Etc/GMT-3": "GMT+3",
  "Etc/GMT-4": "GMT+4",
  "Etc/GMT-5": "GMT+5",
  "Etc/GMT-6": "GMT+6",
  "Etc/GMT-7": "GMT+7",
  "Etc/GMT-8": "GMT+8",
  "Etc/GMT-9": "GMT+9",
  "Etc/GMT-10": "GMT+10",
  "Etc/GMT-11": "GMT+11",
  "Etc/GMT-12": "GMT+12",
};

// Common timezone mappings for major cities/regions (for location-based detection)
const TIMEZONE_MAP: Record<string, string> = {
  // US Cities
  "new york": "America/New_York",
  nyc: "America/New_York",
  manhattan: "America/New_York",
  brooklyn: "America/New_York",
  chicago: "America/Chicago",
  "los angeles": "America/Los_Angeles",
  la: "America/Los_Angeles",
  "san francisco": "America/Los_Angeles",
  sf: "America/Los_Angeles",
  seattle: "America/Los_Angeles",
  denver: "America/Denver",
  phoenix: "America/Phoenix",
  arizona: "America/Phoenix",
  miami: "America/New_York",
  atlanta: "America/New_York",
  dallas: "America/Chicago",
  houston: "America/Chicago",
  austin: "America/Chicago",
  "las vegas": "America/Los_Angeles",
  portland: "America/Los_Angeles",
  boston: "America/New_York",
  washington: "America/New_York",
  dc: "America/New_York",

  // International
  london: "Europe/London",
  paris: "Europe/Paris",
  berlin: "Europe/Berlin",
  amsterdam: "Europe/Amsterdam",
  rome: "Europe/Rome",
  madrid: "Europe/Madrid",
  barcelona: "Europe/Madrid",
  zurich: "Europe/Zurich",
  vienna: "Europe/Vienna",
  prague: "Europe/Prague",
  stockholm: "Europe/Stockholm",
  copenhagen: "Europe/Copenhagen",
  oslo: "Europe/Oslo",
  helsinki: "Europe/Helsinki",
  dublin: "Europe/Dublin",
  lisbon: "Europe/Lisbon",
  athens: "Europe/Athens",
  moscow: "Europe/Moscow",
  istanbul: "Europe/Istanbul",
  tokyo: "Asia/Tokyo",
  osaka: "Asia/Tokyo",
  seoul: "Asia/Seoul",
  beijing: "Asia/Shanghai",
  shanghai: "Asia/Shanghai",
  "hong kong": "Asia/Hong_Kong",
  singapore: "Asia/Singapore",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  bangalore: "Asia/Kolkata",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane",
  perth: "Australia/Perth",
  auckland: "Pacific/Auckland",
  wellington: "Pacific/Auckland",
  toronto: "America/Toronto",
  vancouver: "America/Vancouver",
  montreal: "America/Montreal",
  "mexico city": "America/Mexico_City",
  "sao paulo": "America/Sao_Paulo",
  "rio de janeiro": "America/Sao_Paulo",
  "buenos aires": "America/Argentina/Buenos_Aires",
  santiago: "America/Santiago",
  lima: "America/Lima",
  bogota: "America/Bogota",
  caracas: "America/Caracas",
  "cape town": "Africa/Johannesburg",
  johannesburg: "Africa/Johannesburg",
  cairo: "Africa/Cairo",
  lagos: "Africa/Lagos",
  nairobi: "Africa/Nairobi",
  casablanca: "Africa/Casablanca",

  // States/Regions
  california: "America/Los_Angeles",
  texas: "America/Chicago",
  florida: "America/New_York",
  "new york state": "America/New_York",
  illinois: "America/Chicago",
  "washington state": "America/Los_Angeles",
  oregon: "America/Los_Angeles",

  // Countries (use major city timezone)
  usa: "America/New_York",
  "united states": "America/New_York",
  uk: "Europe/London",
  "united kingdom": "Europe/London",
  england: "Europe/London",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  italy: "Europe/Rome",
  spain: "Europe/Madrid",
  netherlands: "Europe/Amsterdam",
  switzerland: "Europe/Zurich",
  austria: "Europe/Vienna",
  belgium: "Europe/Brussels",
  sweden: "Europe/Stockholm",
  norway: "Europe/Oslo",
  denmark: "Europe/Copenhagen",
  finland: "Europe/Helsinki",
  ireland: "Europe/Dublin",
  portugal: "Europe/Lisbon",
  greece: "Europe/Athens",
  poland: "Europe/Warsaw",
  japan: "Asia/Tokyo",
  "south korea": "Asia/Seoul",
  korea: "Asia/Seoul",
  china: "Asia/Shanghai",
  india: "Asia/Kolkata",
  australia: "Australia/Sydney",
  canada: "America/Toronto",
  mexico: "America/Mexico_City",
  brazil: "America/Sao_Paulo",
  argentina: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago",
  peru: "America/Lima",
  colombia: "America/Bogota",
  venezuela: "America/Caracas",
  "south africa": "Africa/Johannesburg",
  egypt: "Africa/Cairo",
  nigeria: "Africa/Lagos",
  kenya: "Africa/Nairobi",
  morocco: "Africa/Casablanca",
};

/**
 * Gets the user's local timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Validates if a timezone identifier is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Try to create a DateTimeFormat with the timezone
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to detect the timezone for an event based on timezone tags and location
 */
export function getEventTimezone(
  event: DateBasedEvent | TimeBasedEvent
): string | null {
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
    console.debug("No timezone tags or location found for event");
    return null;
  }

  const locationLower = location.toLowerCase().trim();

  // Try exact match first
  if (TIMEZONE_MAP[locationLower]) {
    console.debug(
      `Detected timezone from location "${location}": ${TIMEZONE_MAP[locationLower]}`
    );
    return TIMEZONE_MAP[locationLower];
  }

  // Try partial matches
  for (const [key, timezone] of Object.entries(TIMEZONE_MAP)) {
    if (locationLower.includes(key)) {
      console.debug(
        `Detected timezone from location "${location}" (partial match "${key}"): ${timezone}`
      );
      return timezone;
    }
  }

  console.debug(`Could not detect timezone for location: ${location}`);
  return null;
}

/**
 * Converts a timestamp from one timezone to another
 */
export function convertTimezone(
  timestamp: number,
  fromTimezone: string | null,
  toTimezone: string | null
): number {
  if (!fromTimezone || !toTimezone || fromTimezone === toTimezone) {
    return timestamp;
  }

  try {
    const date = new Date(timestamp);

    // Get the offset in minutes for both timezones
    const fromOffset = getTimezoneOffset(date, fromTimezone);
    const toOffset = getTimezoneOffset(date, toTimezone);

    // Calculate the difference in milliseconds
    const offsetDiff = (toOffset - fromOffset) * 60 * 1000;

    return timestamp + offsetDiff;
  } catch (error) {
    console.warn(
      `Error converting timezone from ${fromTimezone} to ${toTimezone}:`,
      error
    );
    return timestamp;
  }
}

/**
 * Gets the timezone offset in minutes for a given date and timezone
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  try {
    // Create a date string in the target timezone
    const dateInTimezone = date.toLocaleString("en-US", { timeZone: timezone });

    // Create a new date object from the timezone-specific string
    const timezoneDate = new Date(dateInTimezone);

    // Get the UTC time of the original date
    const utcTime = date.getTime();

    // Get the UTC time of the timezone-specific date
    const timezoneUtcTime = timezoneDate.getTime();

    // Calculate the offset in minutes
    const offsetMs = utcTime - timezoneUtcTime;
    return Math.round(offsetMs / (60 * 1000));
  } catch (error) {
    console.warn(`Error getting timezone offset for ${timezone}:`, error);
    return 0;
  }
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
      console.warn(
        `Invalid timezone: ${timezone}, falling back to browser timezone`
      );
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
      console.warn(
        `Invalid timezone: ${timezone}, falling back to browser timezone`
      );
    }
  }

  // Fallback to browser timezone
  return date.toLocaleTimeString(undefined, formatOptions);
}

/**
 * Gets the timezone abbreviation for a given timezone and timestamp
 */
export function getTimezoneAbbreviation(
  timezone: string | null,
  timestamp: number = Date.now()
): string {
  if (!timezone) {
    return "";
  }

  try {
    const date = new Date(timestamp);
    const timeZoneName = date.toLocaleString("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    });

    // Extract the timezone abbreviation (last part after space)
    const parts = timeZoneName.split(" ");
    return parts[parts.length - 1] || "";
  } catch {
    console.warn(`Could not get abbreviation for timezone: ${timezone}`);
    return "";
  }
}

/**
 * Gets a formatted timezone list for display in select components
 */
export function getTimezoneOptions(): Array<{ value: string; label: string }> {
  return Object.entries(TIMEZONES).map(([value, label]) => ({
    value,
    label: `${label} (${value})`,
  }));
}

/**
 * Gets timezone options grouped by region for better organization
 */
export function getGroupedTimezoneOptions(): Array<{
  group: string;
  options: Array<{ value: string; label: string }>;
}> {
  const groups: Record<string, Array<{ value: string; label: string }>> = {
    "North America": [],
    Europe: [],
    Asia: [],
    Africa: [],
    Oceania: [],
    Other: [],
  };

  Object.entries(TIMEZONES).forEach(([value, label]) => {
    if (value.startsWith("America/")) {
      groups["North America"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Europe/")) {
      groups["Europe"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Asia/")) {
      groups["Asia"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Africa/")) {
      groups["Africa"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Australia/") || value.startsWith("Pacific/")) {
      groups["Oceania"].push({ value, label: `${label} (${value})` });
    } else {
      groups["Other"].push({ value, label: `${label} (${value})` });
    }
  });

  return Object.entries(groups)
    .filter(([_, options]) => options.length > 0)
    .map(([group, options]) => ({ group, options }));
}

/**
 * Converts a date and time in a specific timezone to a Unix timestamp
 */
export function createTimestampInTimezone(
  dateString: string, // YYYY-MM-DD format
  timeString: string, // HH:MM format
  timezone: string
): number {
  try {
    // Create a date string in ISO format
    const dateTimeString = `${dateString}T${timeString}:00`;

    // Create a date object - this will be interpreted in the local timezone
    const localDate = new Date(dateTimeString);

    // Get the timezone offset for the target timezone
    const targetOffset = getTimezoneOffsetMinutes(timezone, localDate);
    const localOffset = localDate.getTimezoneOffset();

    // Calculate the difference and adjust
    const offsetDiff = targetOffset - localOffset;
    const adjustedTimestamp = localDate.getTime() + offsetDiff * 60 * 1000;

    return Math.floor(adjustedTimestamp / 1000);
  } catch (error) {
    console.error("Error creating timestamp in timezone:", error);
    // Fallback to local timezone
    const dateTimeString = `${dateString}T${timeString}:00`;
    return Math.floor(new Date(dateTimeString).getTime() / 1000);
  }
}

/**
 * Gets the timezone offset in minutes for a specific timezone and date
 */
function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
  try {
    // Create a date string in the target timezone
    const dateInTimezone = date.toLocaleString("en-US", { timeZone: timezone });

    // Create a new date object from the timezone-specific string
    const timezoneDate = new Date(dateInTimezone);

    // Get the UTC time of the original date
    const utcTime = date.getTime();

    // Get the UTC time of the timezone-specific date
    const timezoneUtcTime = timezoneDate.getTime();

    // Calculate the offset in minutes
    const offsetMs = utcTime - timezoneUtcTime;
    return Math.round(offsetMs / (60 * 1000));
  } catch (error) {
    console.warn(`Error getting timezone offset for ${timezone}:`, error);
    return 0;
  }
}
