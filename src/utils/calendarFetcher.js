import { logDebug } from './debug';

/**
 * Calendar Fetcher Service
 * 
 * This utility is responsible for fetching event data from calendar338.com
 * It provides both direct API access and caching capabilities.
 */

// Cache for storing fetched events to avoid repeated network requests
let eventCache = {
  lastFetched: null,
  events: {},
  expiryTimeMs: 3600000 // Cache expiry: 1 hour
};

// Configuration for the fetcher
const FETCHER_CONFIG = {
  // Whether to use a proxy for fetching (helps avoid CORS issues)
  useProxy: true,
  
  // Proxy endpoints - in a production environment, this would be a 
  // server endpoint that forwards requests to calendar338.com
  proxyUrl: 'https://api.allorigins.win/raw?url=https://calendar338.com/',
  
  // Direct URL (will have CORS issues in browser environments)
  directUrl: 'https://calendar338.com/'
};

/**
 * Parse the date from calendar338.com format to our standard YYYY-MM-DD format
 * @param {string} dateStr - The date string from the calendar website
 * @returns {string} Formatted date string
 */
const parseCalendarDate = (dateStr) => {
  try {
    // Example formats that might be encountered
    // "Fri 31 May 2024" or "31.05.2024" or other variations
    
    // This is a simplified parser - adjust based on actual format from the site
    const dateParts = dateStr.split(' ');
    if (dateParts.length >= 3) {
      // Format: "Fri 31 May 2024"
      const day = dateParts[1].padStart(2, '0');
      
      // Convert month name to month number
      const months = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      };
      
      const monthLower = dateParts[2].toLowerCase();
      const month = months[monthLower] || '01';
      const year = dateParts[3] || new Date().getFullYear().toString();
      
      return `${year}-${month}-${day}`;
    }
    
    // Fallback for other formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    logDebug('CalendarFetcher', `Unable to parse date: ${dateStr}`);
    return null;
  } catch (error) {
    logDebug('CalendarFetcher', `Error parsing date: ${error.message}`);
    return null;
  }
};

/**
 * Fetch all events from calendar338.com
 * @returns {Promise<Object>} Object containing events indexed by date
 */
export const fetchAllEvents = async () => {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (
      eventCache.lastFetched && 
      eventCache.events && 
      Object.keys(eventCache.events).length > 0 &&
      (now - eventCache.lastFetched) < eventCache.expiryTimeMs
    ) {
      logDebug('CalendarFetcher', 'Using cached event data');
      return eventCache.events;
    }
    
    logDebug('CalendarFetcher', 'Fetching event data from calendar338.com');
    
    // Choose URL based on configuration
    const fetchUrl = FETCHER_CONFIG.useProxy ? FETCHER_CONFIG.proxyUrl : FETCHER_CONFIG.directUrl;
    logDebug('CalendarFetcher', `Using ${FETCHER_CONFIG.useProxy ? 'proxy' : 'direct'} URL: ${fetchUrl}`);
    
    // Fetch the calendar page
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Studio338-Agent-Tech/1.0',
        'Accept': 'text/html'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar data: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    logDebug('CalendarFetcher', 'Successfully fetched calendar page');
    
    // Parse HTML to extract event data
    // This is a simplified approach - for production, consider using a proper HTML parser
    const events = {};
    
    // Simple regex-based extraction - this should be replaced with proper HTML parsing
    // The actual selectors and structure will depend on the calendar338.com website
    const eventRegex = /<div class="event">([\s\S]*?)<\/div>/gi;
    const dateRegex = /<div class="event-date">([\s\S]*?)<\/div>/i;
    const titleRegex = /<div class="event-title">([\s\S]*?)<\/div>/i;
    const timeRegex = /<div class="event-time">([\s\S]*?)<\/div>/i;
    const descRegex = /<div class="event-description">([\s\S]*?)<\/div>/i;
    const ticketsRegex = /<div class="event-tickets">([\s\S]*?)<\/div>/i;
    
    let eventMatch;
    while ((eventMatch = eventRegex.exec(html)) !== null) {
      const eventHTML = eventMatch[1];
      
      // Extract event details
      const dateMatch = eventHTML.match(dateRegex);
      const titleMatch = eventHTML.match(titleRegex);
      const timeMatch = eventHTML.match(timeRegex);
      const descMatch = eventHTML.match(descRegex);
      const ticketsMatch = eventHTML.match(ticketsRegex);
      
      if (dateMatch && titleMatch) {
        const dateStr = dateMatch[1].trim();
        const parsedDate = parseCalendarDate(dateStr);
        
        if (parsedDate) {
          events[parsedDate] = {
            title: titleMatch[1].trim(),
            description: descMatch ? descMatch[1].trim() : "Event at Studio 338",
            time: timeMatch ? timeMatch[1].trim() : "TBA",
            tickets: ticketsMatch ? ticketsMatch[1].trim() : "Available",
            status: "Confirmed",
            source: "calendar338.com",
            capacity: 3000
          };
        }
      }
    }
    
    // If no events were extracted with the regex approach, try an alternative approach
    if (Object.keys(events).length === 0) {
      logDebug('CalendarFetcher', 'No events found with primary approach, trying alternative parser');
      
      // Look for event listings in a more generic way
      // This is a fallback in case the website structure doesn't match our primary regexes
      try {
        // Find event containers with a different pattern
        const altEventRegex = /<div[^>]*class="[^"]*event-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
        const altTitleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/i;
        const altDateRegex = /<span[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
        
        let altEventMatch;
        while ((altEventMatch = altEventRegex.exec(html)) !== null) {
          const eventHTML = altEventMatch[1];
          
          const titleMatch = eventHTML.match(altTitleRegex);
          const dateMatch = eventHTML.match(altDateRegex);
          
          if (titleMatch && dateMatch) {
            const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
            const dateStr = dateMatch[1].replace(/<[^>]*>/g, '').trim();
            const parsedDate = parseCalendarDate(dateStr);
            
            if (parsedDate && title) {
              events[parsedDate] = {
                title: title,
                description: "Event at Studio 338",
                time: "TBA",
                tickets: "Available",
                status: "Confirmed",
                source: "calendar338.com (alt parser)",
                capacity: 3000
              };
            }
          }
        }
      } catch (parseError) {
        logDebug('CalendarFetcher', `Alternative parser error: ${parseError.message}`);
      }
    }
    
    // If we still have no events, use fallback data
    if (Object.keys(events).length === 0) {
      logDebug('CalendarFetcher', 'No events found in the HTML. Using fallback data.');
      
      // In a real implementation, we might want to:
      // 1. Try more parsing techniques
      // 2. Notify administrators
      // 3. Use a cached version of the last successful fetch
      
      // For demonstration, we're using fallback data
      const currentYear = new Date().getFullYear();
      const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
      
      // Sample fallback events - in a real system, this would be more comprehensive
      events[`${currentYear}-05-31`] = {
        title: "ALL DAY I DREAM",
        description: "Electronic music event featuring melodic house",
        time: "14:00 - 23:00",
        tickets: "Available",
        status: "Confirmed",
        source: "Fallback data",
        capacity: 3000
      };
      
      events[`${currentYear}-06-01`] = {
        title: "AMNESIA LONDON 2024",
        description: "AMNESIA IBIZA x STUDIO 338 = Two of the world's most iconic electronic music venues come together!",
        time: "12:00 - 11:00",
        tickets: "Available",
        status: "Confirmed",
        source: "Fallback data",
        capacity: 3000
      };
      
      events[`${currentYear}-${currentMonth}-15`] = {
        title: "UPCOMING EVENT",
        description: "Upcoming electronic music event at Studio 338",
        time: "22:00 - 06:00",
        tickets: "Available",
        status: "Confirmed",
        source: "Fallback data",
        capacity: 3000
      };
    }
    
    // Update cache
    eventCache = {
      lastFetched: now,
      events,
      expiryTimeMs: 3600000
    };
    
    logDebug('CalendarFetcher', `Successfully extracted ${Object.keys(events).length} events`);
    return events;
  } catch (error) {
    logDebug('CalendarFetcher', `Error fetching events: ${error.message}`);
    
    // If we have cached data, use it as a fallback even if it's expired
    if (eventCache.events && Object.keys(eventCache.events).length > 0) {
      logDebug('CalendarFetcher', 'Using expired cache as fallback due to fetch error');
      return eventCache.events;
    }
    
    throw error;
  }
};

/**
 * Get event for a specific date (YYYY-MM-DD format)
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Event object or null if not found
 */
export const getEventForDate = async (dateString) => {
  try {
    // Normalize the date string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    
    const formattedDate = date.toISOString().split('T')[0];
    logDebug('CalendarFetcher', `Checking for event on ${formattedDate}`);
    
    // Get all events (will use cache if available)
    const allEvents = await fetchAllEvents();
    
    // Check if we have an exact date match
    if (allEvents[formattedDate]) {
      logDebug('CalendarFetcher', `Found exact date match for ${formattedDate}`);
      return {
        date: formattedDate,
        eventInfo: allEvents[formattedDate],
        source: 'calendar338.com'
      };
    }
    
    // If exact match not found, try matching just month-day (ignoring year)
    const monthDay = formattedDate.substring(5); // Get MM-DD part
    
    for (const eventDate in allEvents) {
      if (eventDate.substring(5) === monthDay) {
        logDebug('CalendarFetcher', `Found month-day match for ${monthDay} in ${eventDate}`);
        return {
          date: formattedDate,
          eventInfo: allEvents[eventDate],
          source: 'calendar338.com (year-agnostic match)'
        };
      }
    }
    
    // No event found
    logDebug('CalendarFetcher', `No event found for ${formattedDate}`);
    return {
      date: formattedDate,
      needsManagerCheck: true,
      eventInfo: {
        title: "Enter Event Name",
        description: "I don't have information about an event on this date. I can check with the manager for you.",
        checkWithManager: true,
        source: 'Manager Check Required',
        capacity: 3000
      },
      source: 'manager-check'
    };
  } catch (error) {
    logDebug('CalendarFetcher', `Error getting event for date: ${error.message}`);
    return null;
  }
};

/**
 * Force refresh the event cache
 */
export const refreshEventCache = async () => {
  logDebug('CalendarFetcher', 'Forcing cache refresh');
  eventCache.lastFetched = null;
  return await fetchAllEvents();
};

/**
 * Set the fetcher to use proxy or direct mode
 * @param {boolean} useProxy - Whether to use a proxy for fetching
 */
export const setUseProxy = (useProxy) => {
  FETCHER_CONFIG.useProxy = useProxy;
  logDebug('CalendarFetcher', `Set fetcher to ${useProxy ? 'proxy' : 'direct'} mode`);
};

export default {
  getEventForDate,
  fetchAllEvents,
  refreshEventCache,
  setUseProxy
};