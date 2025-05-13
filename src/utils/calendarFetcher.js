import { logDebug } from './debug';
import { getCalendarCache, saveCalendarCache } from './dataStorage'; // Import new cache functions

// Configuration with calendar URL
const FETCHER_CONFIG = {
  useProxy: true,
  directUrl: 'http://calendar338.com',
  proxyUrl: 'https://api.allorigins.win/get?url=http://calendar338.com',
  // cacheExpiryMs: 3600000 // 1 hour cache - Expiry is now handled by dataStorage
};

// In-memory cache for immediate access during the same session if localStorage is slow or fails
// but primary persistence is through dataStorage.
let inMemorySessionCache = {
    events: [],
    lastFetched: null
};

/**
 * Fetches all events from the Studio 338 calendar
 * @returns {Promise<Array>} Array of event objects
 */
async function fetchAllEvents() {
  // Try to get from localStorage first
  const storedCache = getCalendarCache();
  if (storedCache && storedCache.events && storedCache.events.length > 0) {
    logDebug('CalendarFetcher', 'Using calendar data from localStorage.');
    inMemorySessionCache = storedCache; // Sync in-memory with stored version
    return storedCache.events;
  }
  
  // If not in localStorage or expired, try in-memory session cache (less likely to be hit if localStorage is working)
  if (inMemorySessionCache.events.length > 0 && inMemorySessionCache.lastFetched && 
      (Date.now() - inMemorySessionCache.lastFetched < (FETCHER_CONFIG.cacheExpiryMs || 3600000)) ) { // Add default expiry if needed
    logDebug('CalendarFetcher', 'Using in-memory session cache for calendar data.');
    return inMemorySessionCache.events;
  }

  try {
    const fetchUrl = FETCHER_CONFIG.useProxy
      ? FETCHER_CONFIG.proxyUrl
      : FETCHER_CONFIG.directUrl;

    logDebug('CalendarFetcher', `Fetching fresh events from: ${fetchUrl}`);
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    let htmlContent;
    if (FETCHER_CONFIG.useProxy) {
      const data = await response.json();
      htmlContent = data.contents;
    } else {
      htmlContent = await response.text();
    }

    const events = parseCalendarEvents(htmlContent);
    const fetchTimestamp = Date.now();

    // Save to localStorage and update in-memory cache
    saveCalendarCache(events, fetchTimestamp);
    inMemorySessionCache = { events, lastFetched: fetchTimestamp };

    logDebug('CalendarFetcher', `Successfully fetched and cached ${events.length} events`);
    return events;
  } catch (error) {
    logDebug('CalendarFetcher', `Error fetching fresh events: ${error.message}`);
    
    // Fallback to in-memory cache if available, even if stale, on fetch error
    if (inMemorySessionCache.events.length > 0) {
      logDebug('CalendarFetcher', 'Using stale in-memory session cache as fallback due to fetch error.');
      return inMemorySessionCache.events;
    }
    
    return getFallbackEvents(); // Last resort
  }
}

// parseCalendarEvents, parseCalendarDate, getMonthIndex, getEventForDate, 
// findNearbyEvents, standardizeDate, getFallbackEvents remain the same as your provided version.
// ... (rest of the functions from your enhanced calendarFetcher.js) ...

/**
 * Parse events from calendar HTML content
 * @param {string} htmlContent - HTML content from calendar page
 * @returns {Array} Array of parsed event objects
 */
function parseCalendarEvents(htmlContent) {
  const events = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const eventElements = doc.querySelectorAll('.event-item, .calendar-event');
    
    eventElements.forEach(element => {
      try {
        const title = element.querySelector('.event-title, .title')?.textContent.trim() || 'Untitled Event';
        const dateText = element.querySelector('.event-date, .date')?.textContent.trim() || '';
        const timeText = element.querySelector('.event-time, .time')?.textContent.trim() || '';
        const description = element.querySelector('.event-description, .description')?.textContent.trim() || '';
        const eventDate = parseCalendarDate(dateText);
        
        events.push({
          title,
          date: eventDate,
          rawDateText: dateText,
          time: timeText,
          description,
          ticketsAvailable: element.textContent.toLowerCase().includes('tickets') || 
                            element.textContent.toLowerCase().includes('book'),
          url: element.querySelector('a')?.href || ''
        });
      } catch (parseError) {
        logDebug('CalendarFetcher', `Error parsing individual event: ${parseError.message}`);
      }
    });
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    logDebug('CalendarFetcher', `Error parsing events HTML: ${error.message}`);
  }
  return events.length > 0 ? events : getFallbackEvents();
}

function parseCalendarDate(dateStr) {
  if (!dateStr) return '';
  try {
    let parsedDate;
    const longFormatMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (longFormatMatch) {
      const [_, day, month, year] = longFormatMatch;
      parsedDate = new Date(parseInt(year), getMonthIndex(month), parseInt(day));
    } else if (dateStr.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/)) {
      const parts = dateStr.split(/[-\/]/);
      parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else if (dateStr.match(/[A-Za-z]+\s+\d{1,2},\s+\d{4}/)) {
      parsedDate = new Date(dateStr);
    } else {
      parsedDate = new Date(dateStr);
    }
    if (isNaN(parsedDate.getTime())) throw new Error('Invalid date');
    return parsedDate.toISOString().split('T')[0];
  } catch (error) {
    logDebug('CalendarFetcher', `Error parsing date "${dateStr}": ${error.message}`);
    return '';
  }
}

function getMonthIndex(monthName) {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const normalizedName = monthName.toLowerCase();
  let index = months.indexOf(normalizedName);
  if (index !== -1) return index;
  index = shortMonths.indexOf(normalizedName.substring(0, 3));
  if (index !== -1) return index;
  for (let i = 0; i < months.length; i++) {
    if (months[i].startsWith(normalizedName)) return i;
  }
  return 0;
}

async function getEventForDate(dateString) {
  try {
    const standardDate = standardizeDate(dateString);
    if (!standardDate) return { found: false, message: 'Invalid date format' };
    const events = await fetchAllEvents();
    const exactMatch = events.find(event => event.date === standardDate);
    if (exactMatch) return { found: true, exact: true, event: exactMatch };
    const nearbyEvents = findNearbyEvents(events, standardDate, 3);
    if (nearbyEvents.length > 0) return { found: true, exact: false, events: nearbyEvents };
    return { found: false, message: 'No events found for this date' };
  } catch (error) {
    logDebug('CalendarFetcher', `Error in getEventForDate: ${error.message}`);
    return { found: false, error: true, message: 'Error fetching event information' };
  }
}

function findNearbyEvents(events, targetDate, dayRange = 3) {
  const targetTimestamp = new Date(targetDate).getTime();
  const dayInMs = 86400000;
  return events.filter(event => {
    if (!event.date) return false;
    const eventTimestamp = new Date(event.date).getTime();
    return Math.abs(eventTimestamp - targetTimestamp) <= (dayRange * dayInMs);
  });
}

function standardizeDate(dateString) {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    let date;
    if (dateString.includes('/') || dateString.includes('-')) {
      const parts = dateString.split(/[-\/]/);
      if (parts[2] && parts[2].length === 4) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (isNaN(date.getTime())) date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    logDebug('CalendarFetcher', `Error standardizing date "${dateString}": ${error.message}`);
    return '';
  }
}

function getFallbackEvents() {
  const now = new Date();
  const upcomingDates = [];
  let date = new Date(now);
  while (date.getDay() !== 5) date.setDate(date.getDate() + 1);
  for (let i = 0; i < 5; i++) {
    upcomingDates.push(new Date(date));
    date.setDate(date.getDate() + 1);
    upcomingDates.push(new Date(date));
    date.setDate(date.getDate() + 6);
  }
  return upcomingDates.map(d => {
    const isFriday = d.getDay() === 5;
    const dateStr = d.toISOString().split('T')[0];
    return {
      title: isFriday ? `Friday Night Live at Studio 338 (${dateStr})` : `Saturday Sessions (${dateStr})`,
      date: dateStr,
      rawDateText: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: isFriday ? '22:00 - 04:00' : '21:00 - 06:00',
      description: 'Join us for an amazing night at Studio 338 with world-class music and entertainment.',
      ticketsAvailable: true, url: '', isFallback: true
    };
  });
}

/**
 * Force refresh of the event cache
 * @returns {Promise<Array>} Updated array of events
 */
async function refreshEventCache() {
  logDebug('CalendarFetcher', 'Forcing cache refresh. Clearing localStorage and in-memory session cache.');
  localStorage.removeItem('calendarCache'); // Assuming CALENDAR_CACHE_KEY from dataStorage is 'calendarCache'
  inMemorySessionCache = { events: [], lastFetched: null };
  return await fetchAllEvents();
}

/**
 * Set whether to use proxy for fetching
 * @param {boolean} useProxy - Whether to use proxy
 */
function setUseProxy(useProxy) {
  FETCHER_CONFIG.useProxy = useProxy;
  logDebug('CalendarFetcher', `Set fetcher to ${useProxy ? 'proxy' : 'direct'} mode`);
}

export default {
  fetchAllEvents,
  getEventForDate,
  refreshEventCache,
  setUseProxy
};
