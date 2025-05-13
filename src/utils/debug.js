/**
 * Basic debug logging utility.
 * @param {string} context - The context of the log (e.g., component or module name).
 * @param {string} message - The message to log.
 * @param  {...any} optionalParams - Additional data to log.
 */
export const logDebug = (context, message, ...optionalParams) => {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_DEBUG === 'true') {
    console.log(`[${timestamp}] [${context}] ${message}`, ...optionalParams);
  }
};

/**
 * Logs PDF processing progress.
 * @param {string} stage - The stage of PDF processing.
 * @param {any} data - Data related to the progress.
 */
export const logPdfProgress = (stage, data) => {
  if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_PDF_DEBUG === 'true') {
    console.log(`[PDF Processor - ${stage}]:`, data);
  }
};

export default {
  logDebug,
  logPdfProgress
};
