import { fetchAllEvents, getEventForDate } from './calendarFetcher';
import { extractPdfContent, searchKnowledgeBase as searchPdfKB } from './pdfProcessor'; // Renamed to avoid conflict
import SpecificationManager from './SpecificationManager'; // Import the manager

// Initialize SpecificationManager - assuming local file mode for now
const specManager = new SpecificationManager({
  useApi: false,
  localFilePath: './data/specifications.json' // Relative to where node/bundler runs, might need adjustment
});

let isInitialized = false;

/**
 * Initializes all knowledge sources.
 */
export async function initializeKnowledgeBase() {
  if (isInitialized) return true;
  try {
    console.log('Initializing knowledge base...');
    // Initialize specifications from specifications.json
    await specManager.initialize();
    console.log('Specification Manager initialized.');

    // Initialize calendar events (uses its own cache or fetches)
    await fetchAllEvents();
    console.log('Calendar Fetcher initialized (events fetched/cached).');

    // Initialize PDF content (assuming path relative to public folder or where app is served)
    // The path '/docs/technical-bible.pdf' implies it's served from the root of the public dir.
    // This path needs to be correct for your server setup.
    await extractPdfContent('/docs/technical-bible.pdf'); 
    console.log('PDF Processor initialized (content extracted).');

    isInitialized = true;
    console.log('All knowledge sources initialized.');
    return true;
  } catch (error) {
    console.error('Failed to initialize knowledge base:', error);
    isInitialized = false;
    return false;
  }
}

/**
 * Answers a question by querying all available knowledge sources.
 * @param {string} question - The user's question.
 * @returns {Promise<string>} - A formatted answer.
 */
export async function answerQuestion(question) {
  if (!isInitialized) {
    return "I'm still getting set up. Please try again in a moment.";
  }

  const questionLower = question.toLowerCase();
  let responses = [];

  // 1. Check for event-related questions (e.g., "What's on May 31st?")
  // Simple date detection - can be made more robust
  const dateMatch = question.match(/(\d{4}-\d{2}-\d{2})|(\w+ \d{1,2}(st|nd|rd|th)?( \d{4})?)/i);
  if (dateMatch && dateMatch[0]) {
    try {
      const eventData = await getEventForDate(dateMatch[0]);
      if (eventData && eventData.eventInfo && !eventData.needsManagerCheck) {
        responses.push(`On ${eventData.date}: ${eventData.eventInfo.title}. ${eventData.eventInfo.description} (Time: ${eventData.eventInfo.time}, Tickets: ${eventData.eventInfo.tickets}).`);
      } else if (eventData && eventData.needsManagerCheck) {
        responses.push(eventData.eventInfo.description);
      }
    } catch (e) {
      console.warn('Could not parse date from question for calendar lookup:', question);
    }
  }

  // 2. Search PDF Knowledge Base (from pdfProcessor.js)
  const pdfResults = searchPdfKB(question);
  if (pdfResults && pdfResults.length > 0 && !pdfResults[0].type?.includes('error')) {
    pdfResults.slice(0, 2).forEach(res => { // Limit to a couple of relevant PDF results
      if(res.type === 'faq') {
        responses.push(`From the technical docs (FAQ): Q: ${res.question} A: ${res.answer}`);
      } else if (res.type === 'equipment') {
        responses.push(`Regarding ${res.name} (equipment): Quantity: ${res.quantity}, Specs: ${res.specifications || 'N/A'}. (Source: PDF Page ${res.pages?.join(', ')})`);
      } else if (res.type === 'specification' || res.type === 'raw_text') {
        responses.push(`From the technical docs (Page ${res.page || 'N/A'}): ${res.content.substring(0, 200)}...`);
      }
    });
  }

  // 3. Search Specifications JSON (via SpecificationManager)
  // Example: "Tell me about CDJ-3000" or "What is the resolution of the main LED wall?"
  const specItem = specManager.getItemById(questionLower); // Simple ID lookup for now
  if (specItem) {
    responses.push(`From current specs for ${specItem.name}: ${JSON.stringify(specItem, null, 2)}`);
  }
  // More sophisticated search within specManager.specs could be added here if needed
  // e.g. by iterating getItemsByCategory or searching all items based on keywords in question

  if (responses.length > 0) {
    return responses.join('\n\n---\n\n');
  }

  return "I couldn't find specific information for your query in my current knowledge. Please try rephrasing or ask about Studio 338 events, technical specifications, or equipment.";
}

// Ensure initialization is attempted when the app loads.
// In a real app, this might be triggered by App.js
// initializeKnowledgeBase(); // We will call this from App.js as per your plan

export default {
  initializeKnowledgeBase,
  answerQuestion,
  // Expose specManager if other parts of the app need direct access (e.g., for budget calculator)
  getSpecificationManager: () => specManager 
};
