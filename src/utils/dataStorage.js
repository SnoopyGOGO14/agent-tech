import { logDebug } from './debug';

const CALENDAR_CACHE_KEY = 'calendarCache';
const CACHE_EXPIRY_MS = 3600000; // 1 hour, same as in calendarFetcher

/**
 * Saves the calendar event cache to localStorage.
 * @param {Array} events - The array of event objects.
 * @param {number} timestamp - The timestamp of when the data was fetched.
 */
export function saveCalendarCache(events, timestamp) {
  try {
    const cacheData = {
      events,
      fetchTimestamp: timestamp, // Timestamp of when data was fetched
      expiryTimestamp: Date.now() + CACHE_EXPIRY_MS // When this cache entry should expire
    };
    localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(cacheData));
    logDebug('DataStorage', 'Calendar cache saved to localStorage.');
  } catch (error) {
    logDebug('DataStorage', 'Error saving calendar cache to localStorage:', error);
  }
}

/**
 * Retrieves the calendar event cache from localStorage.
 * @returns {Object|null} The cached data (events, fetchTimestamp) or null if not found/expired.
 */
export function getCalendarCache() {
  try {
    const cachedString = localStorage.getItem(CALENDAR_CACHE_KEY);
    if (!cachedString) {
      logDebug('DataStorage', 'No calendar cache found in localStorage.');
      return null;
    }

    const cacheData = JSON.parse(cachedString);

    // Check if the cache has expired
    if (Date.now() > cacheData.expiryTimestamp) {
      logDebug('DataStorage', 'Calendar cache found but has expired. Clearing it.');
      localStorage.removeItem(CALENDAR_CACHE_KEY);
      return null;
    }

    logDebug('DataStorage', 'Valid calendar cache retrieved from localStorage.');
    return { events: cacheData.events, lastFetched: cacheData.fetchTimestamp }; // Return in format expected by calendarFetcher

  } catch (error) {
    logDebug('DataStorage', 'Error retrieving calendar cache from localStorage:', error);
    // Clear potentially corrupted cache
    localStorage.removeItem(CALENDAR_CACHE_KEY);
    return null;
  }
}

export default {
  saveCalendarCache,
  getCalendarCache
};
