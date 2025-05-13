import { logDebug } from './debug';

/**
 * Calendar Fetcher Service
 * 
 * This utility is responsible for fetching event data from calendar338.com
 * It provides both direct API access and caching capabilities.
 */

// Configuration with calendar URL
const FETCHER_CONFIG = {
  useProxy: true,
  directUrl: 'http://calendar338.com',
  proxyUrl: 'https://api.allorigins.win/get?url=http://calendar338.com',
  cacheExpiryMs: 3600000 // 1 hour cache
};

// Cache structure
let eventCache = {
  events: [],
  lastFetched: null,
  expiryTime: FETCHER_CONFIG.cacheExpiryMs
};

/**
 * Fetches all events from the Studio 338 calendar
 * @returns {Promise<Array>} Array of event objects
 */
async function fetchAllEvents() {
  // Check if cache is valid
  if (
    eventCache.events.length > 0 &&
    eventCache.lastFetched &&
    Date.now() - eventCache.lastFetched < eventCache.expiryTime
  ) {
    logDebug('CalendarFetcher', 'Using cached events data'); // Added context for logDebug
    return eventCache.events;
  }

  try {
    // Determine which URL to use based on config
    const fetchUrl = FETCHER_CONFIG.useProxy
      ? FETCHER_CONFIG.proxyUrl
      : FETCHER_CONFIG.directUrl;

    logDebug('CalendarFetcher', `Fetching events from: ${fetchUrl}`); // Added context
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    let htmlContent;
    if (FETCHER_CONFIG.useProxy) {
      // Extract content from proxy response
      const data = await response.json();
      htmlContent = data.contents;
    } else {
      htmlContent = await response.text();
    }

    // Parse events from HTML
    const events = parseCalendarEvents(htmlContent);

    // Update cache
    eventCache.events = events;
    eventCache.lastFetched = Date.now();

    logDebug('CalendarFetcher', `Successfully fetched ${events.length} events`); // Added context
    return events;
  } catch (error) {
    logDebug('CalendarFetcher', `Error fetching events: ${error.message}`); // Added context
    
    // If cache exists but is expired, still use it as fallback
    if (eventCache.events.length > 0) {
      logDebug('CalendarFetcher', 'Using expired cache as fallback'); // Added context
      return eventCache.events;
    }
    
    // Last resort: return hardcoded fallback events
    return getFallbackEvents();
  }
}

/**
 * Parse events from calendar HTML content
 * @param {string} htmlContent - HTML content from calendar page
 * @returns {Array} Array of parsed event objects
 */
function parseCalendarEvents(htmlContent) {
  const events = [];
  
  try {
    // Create a DOM parser for better HTML handling
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Find event containers - adjust selectors based on actual calendar338.com structure
    const eventElements = doc.querySelectorAll('.event-item, .calendar-event');
    
    eventElements.forEach(element => {
      try {
        // Extract event details - adjust these based on actual HTML structure
        const title = element.querySelector('.event-title, .title')?.textContent.trim() || 'Untitled Event';
        const dateText = element.querySelector('.event-date, .date')?.textContent.trim() || '';
        const timeText = element.querySelector('.event-time, .time')?.textContent.trim() || '';
        const description = element.querySelector('.event-description, .description')?.textContent.trim() || '';
        
        // Parse date - handle various formats
        const eventDate = parseCalendarDate(dateText);
        
        // Create event object with all available data
        const event = {
          title,
          date: eventDate,
          rawDateText: dateText,
          time: timeText,
          description,
          ticketsAvailable: element.textContent.toLowerCase().includes('tickets') || 
                            element.textContent.toLowerCase().includes('book'),
          url: element.querySelector('a')?.href || ''
        };
        
        events.push(event);
      } catch (parseError) {
        logDebug('CalendarFetcher', `Error parsing individual event: ${parseError.message}`); // Added context
      }
    });
    
    // Sort events by date (newest first)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    
  } catch (error) {
    logDebug('CalendarFetcher', `Error parsing events HTML: ${error.message}`); // Added context
  }
  
  // If no events could be parsed, return fallback
  if (events.length === 0) {
    return getFallbackEvents();
  }
  
  return events;
}

/**
 * Parse calendar date from various formats to YYYY-MM-DD
 * @param {string} dateStr - Date string from calendar
 * @returns {string} Standardized date in YYYY-MM-DD format
 */
function parseCalendarDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    // Handle various date formats
    let parsedDate;
    
    // Format: "DD Month YYYY" (e.g., "15 June 2024")
    const longFormatMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (longFormatMatch) {
      const [_, day, month, year] = longFormatMatch;
      const monthIndex = getMonthIndex(month);
      parsedDate = new Date(parseInt(year), monthIndex, parseInt(day));
    } 
    // Format: "DD/MM/YYYY" or "DD-MM-YYYY"
    else if (dateStr.match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/)) {
      const parts = dateStr.split(/[-\/]/);
      // Assuming day/month/year format (adjust if month/day/year)
      parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    // Format: "Month DD, YYYY" (e.g., "June 15, 2024")
    else if (dateStr.match(/[A-Za-z]+\s+\d{1,2},\s+\d{4}/)) {
      parsedDate = new Date(dateStr);
    }
    // Try direct parsing as last resort
    else {
      parsedDate = new Date(dateStr);
    }
    
    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format as YYYY-MM-DD
    return parsedDate.toISOString().split('T')[0];
    
  } catch (error) {
    logDebug('CalendarFetcher', `Error parsing date "${dateStr}": ${error.message}`); // Added context
    return '';
  }
}

/**
 * Get month index from month name
 * @param {string} monthName - Month name (e.g., "January", "Jan")
 * @returns {number} Zero-based month index (0-11)
 */
function getMonthIndex(monthName) {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const shortMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  
  const normalizedName = monthName.toLowerCase();
  
  // Check full month names
  const fullNameIndex = months.indexOf(normalizedName);
  if (fullNameIndex !== -1) return fullNameIndex;
  
  // Check abbreviated month names
  const shortNameIndex = shortMonths.indexOf(normalizedName.substring(0, 3));
  if (shortNameIndex !== -1) return shortNameIndex;
  
  // If not found, try to match partial names
  for (let i = 0; i < months.length; i++) {
    if (months[i].startsWith(normalizedName)) return i;
  }
  
  // Default to January if not found
  return 0;
}

/**
 * Get event information for a specific date
 * @param {string} dateString - Date in any common format
 * @returns {Promise<Object>} Event object or null if no event found
 */
async function getEventForDate(dateString) {
  try {
    // First, standardize the input date
    const standardDate = standardizeDate(dateString);
    if (!standardDate) {
      return { found: false, message: 'Invalid date format' };
    }
    
    // Fetch all events
    const events = await fetchAllEvents();
    
    // Try exact date match first
    const exactMatch = events.find(event => event.date === standardDate);
    if (exactMatch) {
      return { 
        found: true, 
        exact: true,
        event: exactMatch 
      };
    }
    
    // If no exact match, try to find events close to this date (within 3 days)
    const nearbyEvents = findNearbyEvents(events, standardDate, 3);
    if (nearbyEvents.length > 0) {
      return {
        found: true,
        exact: false,
        events: nearbyEvents
      };
    }
    
    // No matches found
    return { 
      found: false, 
      message: 'No events found for this date' 
    };
    
  } catch (error) {
    logDebug('CalendarFetcher', `Error in getEventForDate: ${error.message}`); // Added context
    return { 
      found: false, 
      error: true,
      message: 'Error fetching event information' 
    };
  }
}

/**
 * Find events close to the specified date
 * @param {Array} events - List of all events
 * @param {string} targetDate - Date in YYYY-MM-DD format
 * @param {number} dayRange - Number of days to look before and after
 * @returns {Array} Matching events within the date range
 */
function findNearbyEvents(events, targetDate, dayRange = 3) {
  const targetTimestamp = new Date(targetDate).getTime();
  const dayInMs = 86400000; // 24 hours in milliseconds
  
  return events.filter(event => {
    if (!event.date) return false;
    
    const eventTimestamp = new Date(event.date).getTime();
    const difference = Math.abs(eventTimestamp - targetTimestamp);
    
    // Check if within range (dayRange days before or after)
    return difference <= (dayRange * dayInMs);
  });
}

/**
 * Standardize date to YYYY-MM-DD format
 * @param {string} dateString - Date in any common format
 * @returns {string} Standardized date or empty string if invalid
 */
function standardizeDate(dateString) {
  try {
    // Handle different input formats
    let date;
    
    // If already in YYYY-MM-DD format
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // Try different parsing approaches based on format
    if (dateString.includes('/') || dateString.includes('-')) {
      // Format like DD/MM/YYYY or MM-DD-YYYY
      const parts = dateString.split(/[-\/]/);
      // Determine format based on year position
      if (parts[2] && parts[2].length === 4) {
        // Assume DD/MM/YYYY (typical UK format)
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        
        // If invalid, try MM/DD/YYYY (US format)
        if (isNaN(date.getTime())) {
          date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        }
      } else {
        // Try direct parsing
        date = new Date(dateString);
      }
    } else {
      // Try direct parsing for other formats
      date = new Date(dateString);
    }
    
    // Check if parsing was successful
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
    
  } catch (error) {
    logDebug('CalendarFetcher', `Error standardizing date "${dateString}": ${error.message}`); // Added context
    return '';
  }
}

/**
 * Generate fallback events when calendar fetching fails
 * @returns {Array} Array of hardcoded event objects
 */
function getFallbackEvents() {
  // Current date for reference
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Generate dates for upcoming weekends (typical event days)
  const upcomingDates = [];
  let date = new Date(now);
  
  // Find the next Friday
  while (date.getDay() !== 5) { // 5 = Friday
    date.setDate(date.getDate() + 1);
  }
  
  // Generate 5 weekend dates (Fri + Sat)
  for (let i = 0; i < 5; i++) {
    // Friday
    upcomingDates.push(new Date(date));
    
    // Saturday
    date.setDate(date.getDate() + 1);
    upcomingDates.push(new Date(date));
    
    // Move to next Friday
    date.setDate(date.getDate() + 6);
  }
  
  // Create fallback events
  return upcomingDates.map((date, index) => {
    const isFriday = date.getDay() === 5;
    const dateStr = date.toISOString().split('T')[0];
    
    // Create event names based on day of week
    const eventName = isFriday 
      ? `Friday Night Live at Studio 338 (${dateStr})` 
      : `Saturday Sessions (${dateStr})`;
      
    return {
      title: eventName,
      date: dateStr,
      rawDateText: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: isFriday ? '22:00 - 04:00' : '21:00 - 06:00',
      description: `Join us for an amazing night at Studio 338 with world-class music and entertainment.`,
      ticketsAvailable: true,
      url: '',
      isFallback: true
    };
  });
}

/**
 * Force refresh of the event cache
 * @returns {Promise<Array>} Updated array of events
 */
async function refreshEventCache() {
  // Clear the cache
  eventCache = {
    events: [],
    lastFetched: null,
    expiryTime: FETCHER_CONFIG.cacheExpiryMs
  };
  
  // Fetch fresh data
  return await fetchAllEvents();
}

/**
 * Set whether to use proxy for fetching
 * @param {boolean} useProxy - Whether to use proxy
 */
function setUseProxy(useProxy) {
  FETCHER_CONFIG.useProxy = useProxy;
}

// Export all public functions
export default {
  fetchAllEvents,
  getEventForDate,
  refreshEventCache,
  setUseProxy
};