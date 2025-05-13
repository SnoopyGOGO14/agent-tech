import * as pdfjs from 'pdfjs-dist';
// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';

// Categories of technical information we want to extract
const CATEGORIES = {
  SOUND: ['sound', 'audio', 'speaker', 'pa', 'microphone', 'mixer', 'cdj', 'technics'],
  LIGHTING: ['lighting', 'light', 'strobe', 'beam', 'led', 'rgb'],
  VIDEO: ['video', 'screen', 'projection', 'projector', 'led screen'],
  STAGE: ['stage', 'dimensions', 'truss', 'podium'],
  POWER: ['power', 'electricity', 'amp', 'volt'],
  SPECIAL_FX: ['fx', 'effect', 'smoke', 'pyro', 'confetti', 'co2'],
  RESTRICTIONS: ['restriction', 'limit', 'maximum', 'minimum', 'db', 'decibel']
};

// Main knowledge base to store extracted information
let knowledgeBase = {
  equipment: {},
  specifications: {},
  pricing: {},
  restrictions: {},
  raw: {}, // Store raw text by page and section for fallback searches
};

/**
 * Extracts text content from a PDF file
 * @param {string} pdfUrl - URL to the PDF file
 * @returns {Promise<object>} - Processed knowledge base
 */
export async function extractPdfContent(pdfUrl) {
  try {
    // Load the PDF document
    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded: ${pdf.numPages} pages`);
    
    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      // Store raw text by page
      knowledgeBase.raw[`page_${pageNum}`] = pageText;
      
      // Process different sections based on content
      processPageContent(pageText, pageNum);
    }
    
    // Post-process and organize the knowledge base
    organizeKnowledgeBase();
    
    return knowledgeBase;
  } catch (error) {
    console.error('Error processing PDF:', error);
    return null;
  }
}

/**
 * Process content from a single page
 * @param {string} pageText - Text content from the page
 * @param {number} pageNum - Page number
 */
function processPageContent(pageText, pageNum) {
  // Look for equipment specifications
  extractEquipmentSpecs(pageText, pageNum);
  
  // Look for pricing information
  extractPricingInfo(pageText, pageNum);
  
  // Look for restrictions
  extractRestrictions(pageText, pageNum);
  
  // Categorize content
  categorizeSectionContent(pageText, pageNum);
}

/**
 * Extract equipment specifications
 * @param {string} text - Text to process
 * @param {number} pageNum - Page number for reference
 */
function extractEquipmentSpecs(text, pageNum) {
  // Look for patterns like "X x Product Name" which is common in equipment lists
  const equipmentPattern = /(\d+)\s+x\s+([A-Za-z0-9\s&\-]+)(?:\s+\(([^)]+)\))?/g;
  let match;
  
  while ((match = equipmentPattern.exec(text)) !== null) {
    const quantity = match[1];
    const name = match[2].trim();
    const spec = match[3] ? match[3].trim() : '';
    
    if (!knowledgeBase.equipment[name]) {
      knowledgeBase.equipment[name] = {
        quantity: parseInt(quantity, 10),
        specifications: spec,
        pageReferences: [pageNum]
      };
    } else {
      // Update existing entry if found on multiple pages
      if (!knowledgeBase.equipment[name].pageReferences.includes(pageNum)) {
        knowledgeBase.equipment[name].pageReferences.push(pageNum);
      }
    }
  }
}

/**
 * Extract pricing information
 * @param {string} text - Text to process
 * @param {number} pageNum - Page number for reference
 */
function extractPricingInfo(text, pageNum) {
  // Look for patterns like "£X" or "£X + VAT"
  const pricingPattern = /£(\d+(?:\.\d+)?)\s*(?:\+\s*VAT)?/g;
  let match;
  
  // Also look for descriptions near prices
  const pricingContextPattern = /([A-Za-z0-9\s&\-]+)(?:\s+-\s+)?£(\d+(?:\.\d+)?)/g;
  
  while ((match = pricingPattern.exec(text)) !== null) {
    const price = match[1];
    const contextBefore = text.substring(Math.max(0, match.index - 50), match.index);
    
    // Try to determine what the price is for
    let item = "Unknown item";
    const lastLine = contextBefore.split('.').pop().trim();
    if (lastLine.length > 0 && lastLine.length < 50) {
      item = lastLine;
    }
    
    knowledgeBase.pricing[item] = {
      price: parseFloat(price),
      pageReference: pageNum,
      context: contextBefore
    };
  }
  
  // Process more specific context patterns
  while ((match = pricingContextPattern.exec(text)) !== null) {
    const item = match[1].trim();
    const price = match[2];
    
    knowledgeBase.pricing[item] = {
      price: parseFloat(price),
      pageReference: pageNum
    };
  }
}

/**
 * Extract restrictions and limitations
 * @param {string} text - Text to process
 * @param {number} pageNum - Page number for reference
 */
function extractRestrictions(text, pageNum) {
  // Look for common restriction indicators
  const restrictionKeywords = [
    'maximum', 'minimum', 'limit', 'restriction', 'not allowed',
    'prohibited', 'must', 'cannot', 'db limit', 'decibel'
  ];
  
  for (const keyword of restrictionKeywords) {
    if (text.toLowerCase().includes(keyword)) {
      // Get the sentence containing the keyword
      const sentences = text.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          if (!knowledgeBase.restrictions[keyword]) {
            knowledgeBase.restrictions[keyword] = [];
          }
          knowledgeBase.restrictions[keyword].push({
            description: sentence.trim(),
            pageReference: pageNum
          });
        }
      }
    }
  }
}

/**
 * Categorize content into sections
 * @param {string} text - Text to process
 * @param {number} pageNum - Page number for reference
 */
function categorizeSectionContent(text, pageNum) {
  const lowerText = text.toLowerCase();
  
  // Categorize content based on keywords
  Object.entries(CATEGORIES).forEach(([category, keywords]) => {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        if (!knowledgeBase.specifications[category]) {
          knowledgeBase.specifications[category] = [];
        }
        
        // Find paragraphs containing the keyword
        const paragraphs = text.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
          if (paragraph.toLowerCase().includes(keyword)) {
            knowledgeBase.specifications[category].push({
              content: paragraph.trim(),
              pageReference: pageNum,
              keyword: keyword
            });
          }
        }
        
        break; // Found a match for this category, move to next category
      }
    }
  });
}

/**
 * Organize and deduplicate the knowledge base
 */
function organizeKnowledgeBase() {
  // Deduplicate entries in specifications
  Object.keys(knowledgeBase.specifications).forEach(category => {
    const uniqueEntries = [];
    const seen = new Set();
    
    knowledgeBase.specifications[category].forEach(entry => {
      if (!seen.has(entry.content)) {
        uniqueEntries.push(entry);
        seen.add(entry.content);
      }
    });
    
    knowledgeBase.specifications[category] = uniqueEntries;
  });
  
  // Add section for frequently asked questions based on extracted data
  generateFAQs();
}

/**
 * Generate frequently asked questions based on extracted data
 */
function generateFAQs() {
  knowledgeBase.faqs = [];
  
  // Generate questions about equipment
  Object.entries(knowledgeBase.equipment).forEach(([name, details]) => {
    knowledgeBase.faqs.push({
      question: `How many ${name} does Studio 338 have?`,
      answer: `Studio 338 has ${details.quantity} ${name}${details.specifications ? ` (${details.specifications})` : ''}.`,
      category: 'EQUIPMENT'
    });
  });
  
  // Generate questions about pricing
  Object.entries(knowledgeBase.pricing).forEach(([item, details]) => {
    if (item !== "Unknown item") {
      knowledgeBase.faqs.push({
        question: `How much does ${item} cost to hire?`,
        answer: `The cost for ${item} is £${details.price.toFixed(2)}${details.context ? ' based on the following information: ' + details.context : ''}.`,
        category: 'PRICING'
      });
    }
  });
  
  // Generate questions about restrictions
  Object.entries(knowledgeBase.restrictions).forEach(([keyword, entries]) => {
    entries.forEach(entry => {
      knowledgeBase.faqs.push({
        question: `What are the restrictions regarding ${keyword}?`,
        answer: entry.description,
        category: 'RESTRICTIONS'
      });
    });
  });
}

/**
 * Search the knowledge base for specific information
 * @param {string} query - Search query
 * @returns {Array} - Matching information
 */
export function searchKnowledgeBase(query) {
  if (!knowledgeBase || Object.keys(knowledgeBase).length === 0) {
    return [{ type: 'error', message: 'Knowledge base not loaded. Please load the PDF first.' }];
  }
  
  const results = [];
  const queryLower = query.toLowerCase();
  
  // Search equipment
  Object.entries(knowledgeBase.equipment).forEach(([name, details]) => {
    if (name.toLowerCase().includes(queryLower)) {
      results.push({
        type: 'equipment',
        name: name,
        quantity: details.quantity,
        specifications: details.specifications,
        pages: details.pageReferences
      });
    }
  });
  
  // Search pricing
  Object.entries(knowledgeBase.pricing).forEach(([item, details]) => {
    if (item.toLowerCase().includes(queryLower)) {
      results.push({
        type: 'pricing',
        item: item,
        price: details.price,
        page: details.pageReference
      });
    }
  });
  
  // Search specifications by category
  Object.entries(knowledgeBase.specifications).forEach(([category, entries]) => {
    entries.forEach(entry => {
      if (entry.content.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'specification',
          category: category,
          content: entry.content,
          page: entry.pageReference
        });
      }
    });
  });
  
  // Search restrictions
  Object.entries(knowledgeBase.restrictions).forEach(([keyword, entries]) => {
    if (keyword.includes(queryLower)) {
      entries.forEach(entry => {
        results.push({
          type: 'restriction',
          keyword: keyword,
          description: entry.description,
          page: entry.pageReference
        });
      });
    }
  });
  
  // Search FAQs
  knowledgeBase.faqs.forEach(faq => {
    if (faq.question.toLowerCase().includes(queryLower) || 
        faq.answer.toLowerCase().includes(queryLower)) {
      results.push({
        type: 'faq',
        question: faq.question,
        answer: faq.answer,
        category: faq.category
      });
    }
  });
  
  // If no structured results, search raw text
  if (results.length === 0) {
    Object.entries(knowledgeBase.raw).forEach(([page, content]) => {
      if (content.toLowerCase().includes(queryLower)) {
        // Extract the relevant paragraph containing the query
        const paragraphs = content.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
          if (paragraph.toLowerCase().includes(queryLower)) {
            results.push({
              type: 'raw_text',
              page: page.replace('page_', ''),
              content: paragraph.trim()
            });
          }
        }
      }
    });
  }
  
  return results;
}

export default {
  extractPdfContent,
  searchKnowledgeBase
};