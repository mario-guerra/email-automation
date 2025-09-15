/**
 * Utilities Module
 * Shared utility functions used across email processing modules
 */

/**
 * Validates configuration and exits with error if missing required properties
 */
(function validateConfig() {
  var missing = [];
  if (!CALENDLY_LINK) missing.push('CALENDLY_LINK');
  if (!LEAD_TRACKER_SHEET_ID) missing.push('LEAD_TRACKER_SHEET_ID');
  if (!YOUR_EMAIL) missing.push('YOUR_EMAIL');
  if (!FOLDER_ID) missing.push('FOLDER_ID');
  if (ENABLE_AI_SUMMARY && !AI_API_KEY) missing.push('AI_API_KEY (required when ENABLE_AI_SUMMARY is true)');
  if (missing.length) {
    var msg = 'Missing required Script Properties: ' + missing.join(', ') + '.\nPlease add them via Project Settings → Script properties.';
    console.error(msg);
    throw new Error(msg);
  }
})();
