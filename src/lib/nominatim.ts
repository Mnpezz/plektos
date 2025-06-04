import { debounce } from "lodash";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

// Cache for search results
const searchCache = new Map<string, NominatimResult[]>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export async function searchLocations(
  query: string
): Promise<NominatimResult[]> {
  if (!query) {
    return [];
  }

  // Check cache first
  const cachedResults = searchCache.get(query);
  if (cachedResults) {
    return cachedResults;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=10&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "Plektos/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache the results
    searchCache.set(query, data);

    // Clear cache after duration
    setTimeout(() => {
      searchCache.delete(query);
    }, CACHE_DURATION);

    return data;
  } catch (error) {
    console.error("Error searching locations:", error);
    return [];
  }
}

// Create a debounced version of the search function
const debouncedSearch = debounce(
  async (query: string): Promise<NominatimResult[]> => {
    return searchLocations(query);
  },
  150,
  { leading: true, trailing: true, maxWait: 500 }
);

// Export a wrapper that ensures we always return a Promise
export const search = (query: string): Promise<NominatimResult[]> => {
  return new Promise((resolve) => {
    debouncedSearch(query).then(resolve);
  });
};
