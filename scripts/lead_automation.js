/*
  lead_automation.js — Google Apps Script

  Purpose:
  - Process incoming lead emails, send a welcome message, log leads to a Google Sheet,
    and run follow-up detection and reminders.

  Runtime & configuration:
  - This script runs inside Google Apps Script (not a local Node process).
  - Required Script Properties (Project Settings → Script properties):
    - CALENDLY_LINK
    - LEAD_TRACKER_SHEET_ID
    - YOUR_EMAIL
    - FOLDER_ID
    - AI_API_KEY (for Gemini API to generate executive summaries - optional for premium feature)
    - ENABLE_AI_SUMMARY (set to 'true' to enable AI summary feature)

  Triggers:
  - Call setupTriggers() to create the time-based triggers:
    - processLeadEmails: every 5 minutes
    - checkFollowUps: every hour

  Notes:
  - `checkFollowUps()` can use the Google Calendar API to detect scheduled events.
    Enable the Advanced Calendar service and the Google Calendar API in the linked GCP project
    if you want calendar-based detection.
  - The script writes metadata columns to the Leads sheet (ReminderSentAt, ThreadId, EventId, MatchMethod).
  - AI Summary feature is controlled by ENABLE_AI_SUMMARY script property (premium feature).
*/

// Configuration: read required values from Apps Script Script Properties
function getConfigValue(key) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key);
  } catch (e) {
    throw new Error('PropertiesService is not available. This script must run in Google Apps Script.');
  }
}

var CALENDLY_LINK = getConfigValue('CALENDLY_LINK');
var LEAD_TRACKER_SHEET_ID = getConfigValue('LEAD_TRACKER_SHEET_ID');
var YOUR_EMAIL = getConfigValue('YOUR_EMAIL');
var FOLDER_ID = getConfigValue('FOLDER_ID');
var AI_API_KEY = getConfigValue('AI_API_KEY');
var ENABLE_AI_SUMMARY = getConfigValue('ENABLE_AI_SUMMARY') === 'true';

// Validate required properties and exit with a clear error if any are missing.
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
var QUESTIONNAIRE_FILES = {
  'Probate': 'probate.txt',
  'Small Business': 'small_business.txt',
  'Estate Planning': 'estate_planning.txt',
  'Traffic/Criminal': 'traffic_criminal.txt'
};

function processLeadEmails() {
  console.log('Script started: Searching for emails...');
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var processedLabel = GmailApp.getUserLabelByName('Processed') || GmailApp.createLabel('Processed');
  var threads = GmailApp.search('subject:"New submission - Law Firm Contact Form" is:unread');
  console.log('Found ' + threads.length + ' matching threads.');
  
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    console.log('Thread ' + i + ' has ' + messages.length + ' messages.');
    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];

      // Only process unread messages to avoid duplicates from thread grouping
      if (!message.isUnread()) {
        console.log('Message ' + j + ' in thread ' + i + ' is already read, skipping.');
        continue;
      }

      var body = message.getPlainBody();
      console.log('Message body: ' + body);
      
      // Parse fields
      var fields = {};
      var lines = body.split('\n');
      for (var k = 0; k < lines.length; k++) {
        var line = lines[k].trim();
        if (line.includes(':')) {
          var parts = line.split(':');
          var key = parts[0].trim();
          var value = parts.slice(1).join(':').trim();
          if (key === 'appointment_types') {
            value = value.replace(/[\[\]"]/g, '').split(',').map(item => item.trim());
          }
          fields[key] = value;
        }
      }
      
      var name = fields['name'] || 'Unknown';
      var phone = fields['phone'] || '';
      var email = fields['email'] || '';
      var preferredDay = fields['preferred_day'] || 'Any';
      var preferredTime = fields['preferred_time'] || 'Any';
      var appointmentTypes = fields['appointment_types'] || [];
      var userMessage = fields['message'] || '';
      
      console.log('Parsed fields: ' + JSON.stringify(fields));
      
      if (!email) {
        console.log('No email found in message, skipping: ' + body);
        continue;
      }
      
      // Fetch questionnaire contents
      var questionnaireContents = '';
      for (var m = 0; m < appointmentTypes.length; m++) {
        var type = appointmentTypes[m].trim();
        var fileName = QUESTIONNAIRE_FILES[type];
        if (fileName) {
          try {
            var files = folder.getFilesByName(fileName);
            if (files.hasNext()) {
              var file = files.next();
              var content = file.getBlob().getDataAsString();
              questionnaireContents += type + ' Questionnaire\n\n' + content + '\n\n';
            } else {
              console.log('File not found: ' + fileName);
              questionnaireContents += type + ' Questionnaire\n\nNo questionnaire available.\n\n';
            }
          } catch (e) {
            console.log('Error fetching file ' + fileName + ': ' + e);
            questionnaireContents += type + ' Questionnaire\n\nError retrieving questionnaire.\n\n';
          }
        }
      }
      
      if (!questionnaireContents) {
        questionnaireContents = 'No specific questionnaire available. Please reply for more details.\n\n';
      }
      
      // Send welcome email
      var subject = 'Welcome to Guerra Law Firm - Next Steps for Your Inquiry';
      var welcomeBody = 'Dear ' + name + ',\n\n' +
                        'Thank you for contacting us! We\'ve received your inquiry about: ' + appointmentTypes.join(', ') + '.\n' +
                        'Your preferred day and time: ' + preferredDay + ' ' + preferredTime + '.\n' +
                        'Your message: ' + userMessage + '\n\n' +
                        'Please answer the following questions to help us prepare for your consultation:\n\n' +
                        questionnaireContents +
                        'To schedule your consultation, please use this link: ' + CALENDLY_LINK + '\n\n' +
                        'Reply with your answers or contact us with any questions.\n\n' +
                        'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
      
      console.log('Attempting to send email to: ' + email);
      try {
        GmailApp.sendEmail(email, subject, welcomeBody, { from: YOUR_EMAIL });
        console.log('Email sent successfully to: ' + email);
      } catch (e) {
        console.log('Failed to send email to ' + email + ': ' + e);
        continue;
      }
      
      // Log to Google Sheet
      try {
        var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
        var sheet = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
        // Ensure header includes ReminderSentAt and ThreadId (non-destructive)
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Appointment Types', 'Message', 'Timestamp', 'Followed Up', 'ReminderSentAt', 'ThreadId', 'EventId', 'MatchMethod', 'ResponseReceived', 'ExecutiveSummary', 'QuestionnaireResponses', 'QuestionnaireParsed']);
        } else {
          // If headers exist but are missing the extra columns, ensure they are present
          if (sheet.getLastColumn() < 11) {
            try { sheet.getRange(1, 10).setValue('ReminderSentAt'); } catch (e) { /* ignore */ }
            try { sheet.getRange(1, 11).setValue('ThreadId'); } catch (e) { /* ignore */ }
          }
        }
        var timestamp = new Date();
        var threadId = '';
        try { threadId = threads[i].getId(); } catch (e) { threadId = ''; }
        // Append row with placeholders for new metadata columns to keep column alignment
        sheet.appendRow([email, name, phone, preferredDay, preferredTime, appointmentTypes.join(', '), userMessage, timestamp, false, '', threadId, '', '', false, '', '', '']);
        console.log('Logged to Sheet: ' + email + ' (threadId=' + threadId + ')');
      } catch (e) {
        console.log('Failed to log to Sheet for ' + email + ': ' + e);
      }
      
      // Mark email as processed
      try {
        message.markRead();
        threads[i].addLabel(processedLabel);
        console.log('Email marked as processed: ' + email);
      } catch (e) {
        console.log('Failed to mark email as processed for ' + email + ': ' + e);
      }
    }
  }
}

function generateExecutiveSummary(emailContent) {
  if (!ENABLE_AI_SUMMARY) {
    console.log('AI Summary feature is disabled');
    return 'AI Summary disabled';
  }
  
  console.log('Generating AI summary for email content length: ' + emailContent.length);
  // Implement retry with exponential backoff for transient AI errors
  var maxAttempts = 3;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + AI_API_KEY;
      var prompt = 'Summarize the key points from this lead\'s email response to our questionnaire. Focus on their answers, expressed concerns, overall sentiment, and highlight anything important for the lawyer to know prior to the call. Call out anything that merits a closer read of the email and/or questionnaire answers. Keep it under 200 words. Use "Important points:" for the highlighted section.\n\nEmail Content:\n' + emailContent;
      var payload = {
        'contents': [{
          'parts': [{ 'text': prompt }]
        }]
      };
      var options = {
        'method': 'post',
        'contentType': 'application/json',
        'payload': JSON.stringify(payload),
        'muteHttpExceptions': true
      };
      console.log('Calling Gemini API (attempt ' + attempt + ')...');
      var response = UrlFetchApp.fetch(url, options);
      var contentText = response.getContentText();
      var json = {};
      try { json = JSON.parse(contentText); } catch (pe) { throw new Error('Invalid JSON from AI: ' + pe + ' -- ' + contentText); }
      if (json.error) {
        throw new Error('AI API error: ' + JSON.stringify(json.error));
      }
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
        var summary = json.candidates[0].content.parts[0].text.trim();
        console.log('AI summary generated successfully, length: ' + summary.length);
        return summary;
      }
      throw new Error('AI API error: Invalid response structure - ' + JSON.stringify(json));
    } catch (e) {
      console.log('AI summary attempt ' + attempt + ' failed: ' + e);
      if (attempt < maxAttempts) {
        var backoff = 1000 * Math.pow(2, attempt - 1);
        console.log('Retrying AI summary after ' + backoff + 'ms...');
        Utilities.sleep(backoff);
        continue;
      }
      console.log('AI summary failed after ' + maxAttempts + ' attempts.');
      return 'Summary unavailable - manual review needed.';
    }
  }
}

// Optional helper: build a simple summary from parsed questionnaire fields when AI is unavailable
function buildSummaryFromParsed(parsed) {
  try {
    if (!parsed || Object.keys(parsed).length === 0) return '';
    var parts = [];
    // Pick a few important keys if present
    var ordered = Object.keys(parsed);
    for (var i = 0; i < ordered.length; i++) {
      var k = ordered[i];
      var v = parsed[k];
      var displayKey = k.replace(/_/g, ' ');
      parts.push(displayKey.charAt(0).toUpperCase() + displayKey.slice(1) + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      if (parts.length >= 5) break; // limit length
    }
    var summary = parts.join('; ');
    return summary.length ? summary : '';
  } catch (e) {
    return '';
  }
}

function checkFollowUps() {
  console.log('Starting follow-up check...');
  console.log('AI Summary feature: ' + (ENABLE_AI_SUMMARY ? 'ENABLED' : 'DISABLED'));
  var lock = LockService.getScriptLock();
  try {
    // Prevent overlapping executions with retry/backoff
    var lockObtained = false;
    var attempts = 0;
    while (!lockObtained && attempts < 5) {
      attempts++;
      lockObtained = lock.tryLock(10 * 1000);
      if (!lockObtained) {
        Utilities.sleep(500 * attempts); // exponential-ish backoff: 0.5s,1s,1.5s...
      }
    }
    if (!lockObtained) {
      console.log('Could not obtain lock after retries; another instance is running. Exiting.');
      return;
    }
    console.log('Lock obtained successfully.');

    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) {
      console.log('Leads sheet not found. Exiting.');
      return;
    }
    console.log('Leads sheet accessed successfully.');

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      console.log('No leads to process.');
      return;
    }
    console.log('Retrieved ' + (data.length - 1) + ' lead rows from sheet.');

    // Column indices (1-based for sheet API)
    var FOLLOWED_UP_COL = 9;
    var REMINDER_AT_COL = 10;
    var THREAD_ID_COL = 11;
    var EVENT_ID_COL = 12;
    var MATCH_METHOD_COL = 13;
    var RESPONSE_RECEIVED_COL = 14;
    var EXECUTIVE_SUMMARY_COL = 15;
  var QUESTIONNAIRE_RESPONSES_COL = 16;
  var QUESTIONNAIRE_PARSED_COL = 17;

    // Ensure headers exist (non-destructive)
    try {
      if (sheet.getLastColumn() < REMINDER_AT_COL) sheet.getRange(1, REMINDER_AT_COL).setValue('ReminderSentAt');
      if (sheet.getLastColumn() < THREAD_ID_COL) sheet.getRange(1, THREAD_ID_COL).setValue('ThreadId');
      if (sheet.getLastColumn() < EVENT_ID_COL) sheet.getRange(1, EVENT_ID_COL).setValue('EventId');
      if (sheet.getLastColumn() < MATCH_METHOD_COL) sheet.getRange(1, MATCH_METHOD_COL).setValue('MatchMethod');
      if (ENABLE_AI_SUMMARY) {
        if (sheet.getLastColumn() < RESPONSE_RECEIVED_COL) sheet.getRange(1, RESPONSE_RECEIVED_COL).setValue('ResponseReceived');
        if (sheet.getLastColumn() < EXECUTIVE_SUMMARY_COL) sheet.getRange(1, EXECUTIVE_SUMMARY_COL).setValue('ExecutiveSummary');
      }
      // Always ensure a column for raw questionnaire responses (store the full plain-text reply)
      try {
        if (sheet.getLastColumn() < QUESTIONNAIRE_RESPONSES_COL) sheet.getRange(1, QUESTIONNAIRE_RESPONSES_COL).setValue('QuestionnaireResponses');
      } catch (e) {
        // ignore
      }
      try {
        if (sheet.getLastColumn() < QUESTIONNAIRE_PARSED_COL) sheet.getRange(1, QUESTIONNAIRE_PARSED_COL).setValue('QuestionnaireParsed');
      } catch (e) {
        // ignore
      }
      console.log('Headers ensured.');
    } catch (e) {
      console.log('Could not ensure headers: ' + e);
    }

    // Track processed emails to prevent duplicate processing in this run
    var processedEmails = new Set();

    for (var row = 1; row < data.length; row++) {
      try {
        var email = (data[row][0] || '').toString().trim();
        var name = (data[row][1] || '').toString().trim();
  var timestampRaw = data[row][7];
  var followedUpRaw = data[row][8];
  var threadIdCell = (data[row][10] || '').toString().trim();
  var responseReceivedRaw = ENABLE_AI_SUMMARY && data[row].length > RESPONSE_RECEIVED_COL - 1 ? data[row][13] : false; // New column
  var executiveSummaryCell = ENABLE_AI_SUMMARY && data[row].length > EXECUTIVE_SUMMARY_COL - 1 ? (data[row][14] || '').toString().trim() : ''; // New column
  var questionnaireResponsesCell = data[row].length > QUESTIONNAIRE_RESPONSES_COL - 1 ? (data[row][QUESTIONNAIRE_RESPONSES_COL - 1] || '').toString().trim() : '';
  var appointmentTypesCell = data[row].length > 5 ? (data[row][5] || '').toString().trim() : '';

        if (!email) {
          console.log('Row ' + (row + 1) + ': No email found, skipping.');
          continue;
        }

        // Skip if this email was already processed in this run (prevents duplicate processing)
        if (processedEmails.has(email.toLowerCase())) {
          console.log('Row ' + (row + 1) + ': Email ' + email + ' already processed in this run, skipping.');
          continue;
        }

        // Normalize followedUp value to boolean
        var followedUp = false;
        if (followedUpRaw === true) followedUp = true;
        else if (typeof followedUpRaw === 'string' && followedUpRaw.toLowerCase() === 'true') followedUp = true;
        else if (!isNaN(Number(followedUpRaw)) && Number(followedUpRaw) === 1) followedUp = true;

        // Normalize responseReceived value to boolean
        var responseReceived = false;
        if (responseReceivedRaw === true) responseReceived = true;
        else if (typeof responseReceivedRaw === 'string' && responseReceivedRaw.toLowerCase() === 'true') responseReceived = true;
        else if (!isNaN(Number(responseReceivedRaw)) && Number(responseReceivedRaw) === 1) responseReceived = true;

        if (followedUp) {
          console.log('Row ' + (row + 1) + ': Already followed up, skipping.');
          continue;
        }

        // Only log detailed processing for rows that need processing
        console.log('Processing row ' + (row + 1) + ': ' + email);
        console.log('Row ' + (row + 1) + ': followedUp=' + followedUp + ', responseReceived=' + responseReceived);

        var timestamp = new Date(timestampRaw);
        if (isNaN(timestamp.getTime())) {
          console.log('Row ' + (row + 1) + ': Invalid timestamp, skipping.');
          continue;
        }

        var replyFound = false;
        var matchedEventId = '';
        var matchedMethod = '';
        var replyContent = '';

        // Helper: simple regex-based parser fallback to extract key:value pairs from reply text
        function parseReplyWithRegex(text, appointmentTypesList) {
          var result = {};
          var cleanedText = '';
          if (!text) return { fields: result, cleaned: cleanedText };
          // Normalize newlines
          text = text.replace(/\r\n/g, '\n');
          // Remove quoted blocks commonly introduced by email clients (lines starting with >)
          text = text.split('\n').filter(function(l){ return !l.trim().startsWith('>'); }).join('\n');
          // Remove common reply headers (e.g., "On Wed, ... wrote:")
          text = text.replace(/\nOn\s.+wrote:\n[\s\S]*/i, '\n');
          // Remove signature separator and anything after it
          text = text.replace(/--\s?[\s\S]*$/m, ''); // signature separator
          // Trim leading/trailing whitespace
          text = text.trim();
          // If appointment types are provided, try to read the questionnaire files and extract question headings
          var questionCandidates = [];
          try {
            if (appointmentTypesList) {
              var types = (typeof appointmentTypesList === 'string') ? appointmentTypesList.split(',').map(function(s){return s.trim();}) : appointmentTypesList;
              var folder = DriveApp.getFolderById(FOLDER_ID);
              for (var ti = 0; ti < types.length; ti++) {
                var t = types[ti];
                if (!t) continue;
                var fileName = QUESTIONNAIRE_FILES[t];
                if (!fileName) continue;
                try {
                  var files = folder.getFilesByName(fileName);
                  if (files.hasNext()) {
                    var f = files.next();
                    var qtext = f.getBlob().getDataAsString();
                    var qlines = qtext.split(/\r?\n/);
                    for (var ql = 0; ql < qlines.length; ql++) {
                      var qltrim = qlines[ql].trim();
                      if (!qltrim) continue;
                      // consider lines that end with a question mark or look like numbered questions
                      if (qltrim.match(/\?\s*$/) || qltrim.match(/^\d+\.|^[A-Z0-9\-]{3,}\:/)) {
                        questionCandidates.push(qltrim.replace(/\s+$/, ''));
                      }
                    }
                  }
                } catch (e) {
                  // ignore file read errors
                }
              }
            }
          } catch (e) {
            // ignore Drive errors
          }

          // Normalize and dedupe question candidates
          var questions = [];
          var seen = {};
          for (var qi = 0; qi < questionCandidates.length; qi++) {
            var qq = questionCandidates[qi].replace(/^\d+\.\s*/, '').trim();
            if (!qq) continue;
            var key = qq.toLowerCase();
            if (!seen[key]) { seen[key] = true; questions.push(qq); }
          }

          // For each known question, try to find an answer following the question text in the reply
          var answersFound = [];
          for (var qj = 0; qj < questions.length; qj++) {
            var qtxt = questions[qj];
            var idx = text.toLowerCase().indexOf(qtxt.toLowerCase());
            if (idx !== -1) {
              var start = idx + qtxt.length;
              var rest = text.substring(start).trim();
              // stop at the next blank line or next question marker
              var stop = rest.search(/\n\s*\n/);
              var answer = stop === -1 ? rest : rest.substring(0, stop).trim();
              var key = qtxt.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              if (answer) {
                result[key] = answer;
                answersFound.push({question: qtxt, answer: answer});
              }
            }
          }

          // If we found answers by matching questions, build a cleanedText from those answers and return
          if (answersFound.length) {
            var linesOut = [];
            for (var aI = 0; aI < answersFound.length; aI++) {
              linesOut.push(answersFound[aI].question);
              linesOut.push(answersFound[aI].answer);
              linesOut.push('');
            }
            cleanedText = linesOut.join('\n').trim();
            return { fields: result, cleaned: cleanedText };
          }

          // Fallback: try to find an explicit 'Questionnaire' block in the reply before quoted material
          var qBlockMatch = text.match(/questionnaire[\s\S]*?:?\n([\s\S]*?)(?:\n\s*On\s|\n>\s|\nFrom:|\nSigned:|$)/i);
          if (qBlockMatch && qBlockMatch[1]) {
            var block = qBlockMatch[1].trim();
            // remove any repeated questionnaire template lines if present
            block = block.replace(/Traffic\/Criminal Questionnaire[\s\S]*/ig, function(m){ return m.split('\n').slice(0,50).join('\n'); });
            // Try to parse key:value within block
            var bLines = block.split(/\r?\n/);
            for (var bl = 0; bl < bLines.length; bl++) {
              var line = bLines[bl].trim();
              if (!line) continue;
              var m2b = line.match(/^([A-Za-z _-]{2,50}):\s*(.+)$/);
              if (m2b) {
                var k2b = m2b[1].trim();
                var v2b = m2b[2].trim();
                var key2b = k2b.toLowerCase().replace(/\s+/g, '_');
                if (v2b.indexOf(',') !== -1) v2b = v2b.split(',').map(function(s) { return s.trim(); });
                result[key2b] = v2b;
              }
            }
            cleanedText = block;
            return { fields: result, cleaned: cleanedText };
          }

          // Final fallback: split into lines and capture key: value pairs over the whole cleaned text
          var lines2 = text.split(/\r?\n/);
          var extractedLines = [];
          for (var li2 = 0; li2 < lines2.length; li2++) {
            var line = lines2[li2].trim();
            if (!line) continue;
            var m2 = line.match(/^([A-Za-z _-]{2,50}):\s*(.+)$/);
            if (m2) {
              var k2 = m2[1].trim();
              var v2 = m2[2].trim();
              var key2 = k2.toLowerCase().replace(/\s+/g, '_');
              if (v2.indexOf(',') !== -1) v2 = v2.split(',').map(function(s) { return s.trim(); });
              result[key2] = v2;
              extractedLines.push(line);
            }
          }
          if (extractedLines.length) cleanedText = extractedLines.join('\n');
          return { fields: result, cleaned: cleanedText };
        }

        // Helper: call AI to parse the reply into structured JSON (questions->answers)
        function parseReplyWithAI(text) {
          if (!ENABLE_AI_SUMMARY || !AI_API_KEY) return null;
          var maxAttemptsAI = 3;
          for (var attemptAI = 1; attemptAI <= maxAttemptsAI; attemptAI++) {
            try {
              var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + AI_API_KEY;
              var prompt = 'You are a strict JSON generator. Parse the following email reply into a single JSON object only. Keys must be the exact questionnaire question titles and values the respondent\'s answers. If an answer contains multiple items, return an array. Do NOT include any explanatory text, markdown, or commentary — return only valid JSON. If you cannot parse, return an empty JSON object {}.\n\nReply:\n' + text;
              var payload = { 'contents': [{ 'parts': [{ 'text': prompt }] }] };
              var options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
              console.log('Calling AI parser (attempt ' + attemptAI + ')...');
              var response = UrlFetchApp.fetch(url, options);
              var contentText = response.getContentText();
              var json = {};
              try { json = JSON.parse(contentText); } catch (pe) { throw new Error('Invalid JSON from AI: ' + pe + ' -- ' + contentText); }
              if (json.error) {
                throw new Error('AI API error: ' + JSON.stringify(json.error));
              }
              if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
                var textOut = json.candidates[0].content.parts[0].text.trim();
                try { return JSON.parse(textOut); } catch (e) {
                  var jsMatch = textOut.match(/(\{[\s\S]*\})/);
                  if (jsMatch) {
                    try { return JSON.parse(jsMatch[1]); } catch (e2) { return null; }
                  }
                }
              }
              throw new Error('AI parser: Invalid response structure - ' + JSON.stringify(json));
            } catch (e) {
              console.log('AI parse attempt ' + attemptAI + ' failed: ' + e);
              if (attemptAI < maxAttemptsAI) {
                var backoffAI = 1000 * Math.pow(2, attemptAI - 1);
                Utilities.sleep(backoffAI);
                continue;
              }
              console.log('AI parser failed after ' + maxAttemptsAI + ' attempts.');
              return null;
            }
          }
        }

        // Primary: try Calendar API (Advanced service) to find events for YOUR_EMAIL
        console.log('Row ' + (row + 1) + ': Checking Calendar API...');
        try {
          var startTime = timestamp;
          var endTime = new Date(timestamp.getTime() + 7 * 24 * 60 * 60 * 1000); // one week window
          try {
            var eventsResp = Calendar.Events.list(YOUR_EMAIL, {
              timeMin: startTime.toISOString(),
              timeMax: endTime.toISOString(),
              maxResults: 250,
              singleEvents: true
            });
            if (eventsResp && eventsResp.items && eventsResp.items.length) {
              for (var ei = 0; ei < eventsResp.items.length; ei++) {
                var ev = eventsResp.items[ei];
                // attendees may be present
                if (ev.attendees && ev.attendees.length) {
                  for (var ai = 0; ai < ev.attendees.length; ai++) {
                    var att = ev.attendees[ai];
                    if (att && att.email && att.email.toLowerCase() === email.toLowerCase()) {
                      replyFound = true;
                      matchedEventId = ev.id || ev.iCalUID || '';
                      matchedMethod = 'calendar-api';
                      console.log('Row ' + (row + 1) + ': Reply found via Calendar API.');
                      // Don't fetch content here - we'll do it once at the end
                      break;
                    }
                  }
                }
                if (replyFound) break;
              }
            }
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Calendar API error: ' + e.message);
          }
        } catch (e) {
          console.log('Row ' + (row + 1) + ': Calendar API check failed: ' + e.message);
        }

        // Secondary: Prefer threadId-based detection if we saved it at logging time
        if (!replyFound) {
          console.log('Row ' + (row + 1) + ': Checking thread ID...');
          if (threadIdCell) {
            try {
              var thread = GmailApp.getThreadById(threadIdCell);
              if (thread && thread.getMessageCount && thread.getMessageCount() > 0) {
                // Check if there are messages in the thread after the original timestamp
                var msgs = thread.getMessages();
                for (var mi = 0; mi < msgs.length; mi++) {
                  if (msgs[mi].getDate().getTime() > timestamp.getTime()) {
                    replyFound = true;
                    matchedMethod = 'threadid';
                    // Don't fetch content here - we'll do it once at the end
                    matchedEventId = thread.getId();
                    console.log('Row ' + (row + 1) + ': Reply found via thread ID.');
                    break;
                  }
                }
              }
            } catch (e) {
              console.log('Row ' + (row + 1) + ': Thread lookup failed: ' + e.message);
            }
          }
        }
        // Tertiary: fallback to conservative Gmail search
        if (!replyFound) {
          console.log('Row ' + (row + 1) + ': Checking Gmail search...');
          var afterEpoch = Math.floor(timestamp.getTime() / 1000);
          var query = 'from:"' + email + '" after:' + afterEpoch + ' in:anywhere';
          try {
            var threadsFound = GmailApp.search(query, 0, 1);
            if (threadsFound && threadsFound.length > 0) {
              replyFound = true;
              matchedMethod = 'gmail-search';
              console.log('Row ' + (row + 1) + ': Reply found via Gmail search.');
              // Don't fetch content here - we'll do it once at the end
            }
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Gmail search error: ' + e.message);
          }
        }

        // Quaternary: scan recent Invitation emails for .ics attachments and parse attendees/UID
        if (!replyFound) {
          console.log('Row ' + (row + 1) + ': Checking ICS attachments...');
          try {
            var invQuery = 'subject:Invitation after:' + afterEpoch + ' in:anywhere';
            var inviteThreads = GmailApp.search(invQuery, 0, 10);
            for (var it = 0; it < inviteThreads.length && !replyFound; it++) {
              var invMsgs = inviteThreads[it].getMessages();
              for (var im = 0; im < invMsgs.length && !replyFound; im++) {
                var invMsg = invMsgs[im];
                var atts = invMsg.getAttachments();
                for (var ai2 = 0; ai2 < atts.length && !replyFound; ai2++) {
                  var att = atts[ai2];
                  var attName = (att.getName && att.getName()) || '';
                  var ctype = (att.getContentType && att.getContentType()) || '';
                  if (attName.toLowerCase().endsWith('.ics') || ctype.indexOf('calendar') !== -1) {
                    var ics = '';
                    try { ics = att.getDataAsString(); } catch (e) { ics = '' + att; }
                    if (ics) {
                      // Find mailto: emails in ATTENDEE or ORGANIZER lines
                      var mailRe = /mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/ig;
                      var m;
                      while ((m = mailRe.exec(ics)) !== null) {
                        if (m[1] && m[1].toLowerCase() === email.toLowerCase()) {
                          replyFound = true;
                          // Extract UID
                          var uidMatch = ics.match(/^UID:(.+)$/m);
                          matchedEventId = (uidMatch && uidMatch[1]) ? uidMatch[1].trim() : '';
                          matchedMethod = 'ics-attachment';
                          console.log('Row ' + (row + 1) + ': Reply found via ICS attachment.');
                          // Don't fetch content here - we'll do it once at the end
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.log('Row ' + (row + 1) + ': ICS scan error: ' + e.message);
          }
        }

        // Fetch email content only once after determining reply was found
        if (replyFound && !replyContent) {
          console.log('Row ' + (row + 1) + ': Fetching email content for method: ' + matchedMethod);
          var afterEpoch = Math.floor(timestamp.getTime() / 1000);
          var query = 'from:"' + email + '" after:' + afterEpoch + ' in:anywhere';
          try {
            var threadsFound = GmailApp.search(query, 0, 1);
            if (threadsFound && threadsFound.length > 0) {
              var foundMsgs = threadsFound[0].getMessages();
              if (foundMsgs && foundMsgs.length > 0) {
                replyContent = foundMsgs[foundMsgs.length - 1].getPlainBody();
                console.log('Row ' + (row + 1) + ': Email content fetched successfully.');
              }
            }
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Failed to fetch email content: ' + e.message);
          }
        }

        // If reply found and not already processed, generate executive summary
        if (replyFound && !responseReceived && replyContent) {
          console.log('Row ' + (row + 1) + ': Generating executive summary for ' + email + ' (method: ' + matchedMethod + ')');
          
          // Parse reply: prefer AI parsing when enabled, fallback to regex parser
          var parsed = null;
          var cleanedForSheet = '';
          if (ENABLE_AI_SUMMARY) {
            parsed = parseReplyWithAI(replyContent);
            if (parsed) {
              console.log('Row ' + (row + 1) + ': AI parsed reply successfully.');
              // Reconstruct a cleaned text block from the parsed JSON so we store only the questionnaire answers
              try {
                var reconstructedLines = [];
                for (var pk in parsed) {
                  if (!parsed.hasOwnProperty(pk)) continue;
                  var val = parsed[pk];
                  // prefer using the key as-is when it looks like a question; otherwise transform
                  var questionTitle = pk;
                  if (typeof questionTitle === 'string' && questionTitle.indexOf('_') !== -1) {
                    questionTitle = questionTitle.replace(/_/g, ' ');
                    questionTitle = questionTitle.charAt(0).toUpperCase() + questionTitle.slice(1);
                  }
                  reconstructedLines.push(questionTitle + '\n' + (Array.isArray(val) ? val.join(', ') : val));
                  reconstructedLines.push('');
                }
                cleanedForSheet = reconstructedLines.join('\n').trim();
              } catch (e) {
                cleanedForSheet = '';
              }
            } else {
              console.log('Row ' + (row + 1) + ': AI parsing failed or returned no JSON, falling back to regex parser.');
            }
          }
          if (!parsed) {
            var regexOut = parseReplyWithRegex(replyContent, appointmentTypesCell);
            // parseReplyWithRegex now returns { fields, cleaned }
            parsed = regexOut.fields || {};
            cleanedForSheet = cleanedForSheet || (regexOut.cleaned || '');
            console.log('Row ' + (row + 1) + ': Regex parser produced ' + Object.keys(parsed).length + ' fields.');
          }
          // Write results: executive summary (AI) and raw + parsed responses
          if (ENABLE_AI_SUMMARY) {
            var summary = generateExecutiveSummary(replyContent);
            // If AI summary failed or returned the unavailable sentinel, build a fallback from parsed fields
            if (!summary || summary.indexOf('Summary unavailable') === 0) {
              var fallback = buildSummaryFromParsed(parsed || {});
              if (fallback) {
                summary = 'Auto-summary: ' + fallback;
              }
            }
            sheet.getRange(row + 1, RESPONSE_RECEIVED_COL).setValue(true);
            sheet.getRange(row + 1, EXECUTIVE_SUMMARY_COL).setValue(summary);
          } else {
            sheet.getRange(row + 1, RESPONSE_RECEIVED_COL).setValue(true);
            sheet.getRange(row + 1, EXECUTIVE_SUMMARY_COL).setValue('AI Summary disabled');
          }
          // Write cleaned questionnaire responses (prefer cleanedForSheet; fallback to trimmed replyContent)
          try { sheet.getRange(row + 1, QUESTIONNAIRE_RESPONSES_COL).setValue(cleanedForSheet || replyContent.trim()); } catch (e) { /* ignore */ }
          try { sheet.getRange(row + 1, QUESTIONNAIRE_PARSED_COL).setValue(JSON.stringify(parsed)); } catch (e) { /* ignore */ }
          console.log('Row ' + (row + 1) + ': Parsed and cleaned responses written to spreadsheet for ' + email);
          
          // Record detection method and mark as followed up
          sheet.getRange(row + 1, MATCH_METHOD_COL).setValue(matchedMethod);
          sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
          console.log('Row ' + (row + 1) + ': Marked as followed up with method: ' + matchedMethod);

          // Mark this email as processed to prevent duplicate processing in this run
          processedEmails.add(email.toLowerCase());

          // Send thank you email
          var thankYouSubject = 'Thank You for Your Response - Guerra Law Firm';
          var thankYouBody = 'Dear ' + name + ',\n\n' +
                             'Thank you for taking the time to respond to our questionnaire. We appreciate your cooperation and look forward to assisting you with your legal needs.\n\n' +
                             'We will review your responses and prepare for our consultation. If you have any additional questions or need to update your information, please don\'t hesitate to reply to this email.\n\n' +
                             'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
          try {
            GmailApp.sendEmail(email, thankYouSubject, thankYouBody, { from: YOUR_EMAIL });
            console.log('Row ' + (row + 1) + ': Thank you email sent to ' + email);
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Failed to send thank you email to ' + email + ': ' + e);
          }
        } else if (replyFound && responseReceived) {
          console.log('Row ' + (row + 1) + ': Reply found but already processed.');
          // Still mark as followed up to prevent reprocessing
          if (!followedUp) {
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
            sheet.getRange(row + 1, MATCH_METHOD_COL).setValue(matchedMethod); // Record match method
          }
        } else if (replyFound && !replyContent) {
          console.log('Row ' + (row + 1) + ': Reply found but no content captured.');
          // Still mark as followed up since we detected a response
          if (!followedUp) {
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
            sheet.getRange(row + 1, MATCH_METHOD_COL).setValue(matchedMethod); // Record match method
          }
        }

        // No reply found -> send gentle reminder to the lead
        if (!replyFound) {
          var hoursSince = (new Date().getTime() - timestamp.getTime()) / (1000 * 60 * 60);
          console.log('Row ' + (row + 1) + ': Hours since contact: ' + hoursSince.toFixed(2));

          if (hoursSince < 24) {
            console.log('Row ' + (row + 1) + ': Too recent (<24h), skipping reminder.');
            continue;
          }

          console.log('Row ' + (row + 1) + ': No reply found, sending reminder...');
          var reminderSubject = 'Gentle Reminder: Follow Up on Your Inquiry with Guerra Law Firm';
          var reminderBody = 'Dear ' + name + ',\n\n' +
                             'This is a gentle reminder about your recent inquiry with Guerra Law Firm.\n\n' +
                             'To help us prepare for your consultation, please take a moment to answer the questions we sent in our previous email and schedule a convenient time using this link: ' + CALENDLY_LINK + '.\n\n' +
                             'We\'re here to assist and look forward to hearing from you soon.\n\n' +
                             'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
          try {
            GmailApp.sendEmail(email, reminderSubject, reminderBody, { from: YOUR_EMAIL });
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
            sheet.getRange(row + 1, REMINDER_AT_COL).setValue(new Date());
            console.log('Row ' + (row + 1) + ': Reminder sent to lead: ' + email);
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Failed to send reminder to lead ' + email + ': ' + e);
            // Fallback: notify the owner
            try {
              var fallbackSubject = 'Reminder Failed: ' + name + ' (' + email + ')';
              var fallbackBody = 'Failed to send reminder to lead ' + name + ' (' + email + '). Error: ' + e;
              GmailApp.sendEmail(YOUR_EMAIL, fallbackSubject, fallbackBody);
              console.log('Row ' + (row + 1) + ': Fallback notification sent to owner for ' + email);
            } catch (fallbackErr) {
              console.log('Row ' + (row + 1) + ': Failed to send fallback notification: ' + fallbackErr);
            }
            // Still mark as followed up to avoid retries
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
            sheet.getRange(row + 1, REMINDER_AT_COL).setValue(new Date());
          }
        } else {
          console.log('Row ' + (row + 1) + ': Reply found, no reminder sent.');
        }
      } catch (rowErr) {
        console.log('Error processing row ' + (row + 1) + ': ' + rowErr);
        // continue to next row
      }
    }
    console.log('Finished processing all rows.');
  } catch (e) {
    console.log('Error in follow-up check: ' + e);
  } finally {
    try { lock.releaseLock(); } catch (releaseErr) { /* ignore */ }
    console.log('Follow-up check completed.');
  }
}
// End of file