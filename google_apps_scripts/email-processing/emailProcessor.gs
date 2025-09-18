/**
 * Email Processing Module
 * Handles incoming lead emails, parsing, welcome emails, and initial logging
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

var QUESTIONNAIRE_FILES = {
  'Probate': 'probate.txt',
  'Small Business': 'small_business.txt',
  'Estate Planning': 'estate_planning.txt',
  'Traffic/Criminal': 'traffic_criminal.txt'
};

/**
 * Test function to verify email parsing works with different formats
 */
function testEmailParsing() {
  console.log('=== EMAIL PARSING TESTS ===');

  // Test 1: Original format
  var testEmail1 = 'name: Sarah Thompson\nemail: sarah@example.com\nphone: 512-555-1234\npreferred_day: Tuesday\npreferred_time: Morning\nappointment_types: ["Estate Planning"]\nmessage: Looking to set up a trust';
  console.log('Test 1 - Original format:');
  console.log('Input:', testEmail1);

  // Test 2: Formspark format
  var testEmail2 = 'Name: Michael Rodriguez\nEmail: michael@example.com\nPhone: 512-555-5678\nPreferred Day: Wednesday\nPreferred Time: Afternoon\nAppointment Types: Probate\nMessage: Need help with father\'s estate';
  console.log('Test 2 - Formspark format:');
  console.log('Input:', testEmail2);

  // Test 3: Simple format
  var testEmail3 = 'email john@example.com\nappointment_types Estate Planning, Probate\nname John Doe\nphone 512-555-9999';
  console.log('Test 3 - Simple format:');
  console.log('Input:', testEmail3);

  console.log('=== TESTS COMPLETED ===');
}
function processLeadEmails() {
  console.log('Script started: Searching for emails...');
  console.log('Accessing questionnaire folder with FOLDER_ID=' + FOLDER_ID);
  var folder;
  try {
    folder = DriveApp.getFolderById(FOLDER_ID);
    console.log('Questionnaire folder name: ' + folder.getName());
  } catch (e) {
    console.log('Failed to access folder by ID ' + FOLDER_ID + ': ' + e);
    throw e;
  }
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

      // Parse fields - handle multiple email formats
      var fields = {};
      var lines = body.split('\n');
      console.log('Parsing email body with ' + lines.length + ' lines');

      // Try different parsing strategies
      var parsedSuccessfully = false;

      // Strategy 1: Original format (key: value)
      if (!parsedSuccessfully) {
        console.log('Trying original parsing format...');
        for (var k = 0; k < lines.length; k++) {
          var line = lines[k].trim();
          if (line.includes(':')) {
            var parts = line.split(':');
            var key = parts[0].trim();
            var value = parts.slice(1).join(':').trim();
            if (key === 'appointment_types') {
              // Handle both array format ["Estate Planning"] and comma-separated "Estate Planning, Probate"
              if (value.startsWith('[') && value.endsWith(']')) {
                value = value.replace(/[\[\]"]/g, '').split(',').map(item => item.trim());
              } else {
                value = value.split(',').map(item => item.trim());
              }
            }
            fields[key] = value;
          }
        }
        // Check if we got essential fields
        if (fields['email'] && (fields['appointment_types'] || fields['name'])) {
          parsedSuccessfully = true;
          console.log('Successfully parsed using original format');
        }
      }

      // Strategy 2: Formspark format (Name: value, Email: value, etc.)
      if (!parsedSuccessfully) {
        console.log('Trying Formspark-style parsing...');
        for (var k = 0; k < lines.length; k++) {
          var line = lines[k].trim();
          // Look for patterns like "Name: Sarah Thompson" or "Email: test@example.com"
          var colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            var key = line.substring(0, colonIndex).trim().toLowerCase();
            var value = line.substring(colonIndex + 1).trim();

            // Map common Formspark field names to our expected keys
            if (key === 'name' || key === 'full name') {
              fields['name'] = value;
            } else if (key === 'email' || key === 'email address') {
              fields['email'] = value;
            } else if (key === 'phone' || key === 'phone number' || key === 'telephone') {
              fields['phone'] = value;
            } else if (key === 'preferred day' || key === 'preferred_day') {
              fields['preferred_day'] = value;
            } else if (key === 'preferred time' || key === 'preferred_time') {
              fields['preferred_time'] = value;
            } else if (key === 'appointment types' || key === 'appointment_types' || key === 'legal area' || key === 'service type') {
              // Handle various formats for appointment types
              if (value.startsWith('[') && value.endsWith(']')) {
                value = value.replace(/[\[\]"]/g, '').split(',').map(item => item.trim());
              } else {
                value = value.split(',').map(item => item.trim());
              }
              fields['appointment_types'] = value;
            } else if (key === 'message' || key === 'comments' || key === 'additional information') {
              fields['message'] = value;
            }
          }
        }
        if (fields['email']) {
          parsedSuccessfully = true;
          console.log('Successfully parsed using Formspark format');
        }
      }

      // Strategy 3: JSON-like format (fallback)
      if (!parsedSuccessfully) {
        console.log('Trying JSON-like parsing...');
        try {
          // Look for JSON-like content in the email
          var jsonMatch = body.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            var jsonData = JSON.parse(jsonMatch[0]);
            fields = jsonData;
            if (jsonData.appointment_types && Array.isArray(jsonData.appointment_types)) {
              fields['appointment_types'] = jsonData.appointment_types;
            }
            parsedSuccessfully = true;
            console.log('Successfully parsed using JSON format');
          }
        } catch (e) {
          console.log('JSON parsing failed: ' + e);
        }
      }

      // Strategy 4: Key-value pairs without colons (simple format)
      if (!parsedSuccessfully) {
        console.log('Trying simple key-value parsing...');
        for (var k = 0; k < lines.length; k++) {
          var line = lines[k].trim();
          // Skip empty lines and headers
          if (!line || line.length < 3 || line.toUpperCase() === line) continue;

          // Look for patterns like "appointment_types Estate Planning"
          var words = line.split(/\s+/);
          if (words.length >= 2) {
            var possibleKey = words[0].toLowerCase();
            var possibleValue = words.slice(1).join(' ');

            if (possibleKey === 'appointment_types' || possibleKey === 'appointment' || possibleKey === 'service') {
              fields['appointment_types'] = possibleValue.split(',').map(item => item.trim());
            } else if (possibleKey === 'email') {
              fields['email'] = possibleValue;
            } else if (possibleKey === 'name') {
              fields['name'] = possibleValue;
            } else if (possibleKey === 'phone') {
              fields['phone'] = possibleValue;
            }
          }
        }
        if (fields['email']) {
          parsedSuccessfully = true;
          console.log('Successfully parsed using simple format');
        }
      }

      if (!parsedSuccessfully) {
        console.log('Failed to parse email with any strategy. Email body: ' + body);
        continue;
      }

      var name = fields['name'] || 'Unknown';
      var phone = fields['phone'] || '';
      var email = fields['email'] || '';
      var preferredDay = fields['preferred_day'] || 'Any';
      var preferredTime = fields['preferred_time'] || 'Any';
      var appointmentTypes = fields['appointment_types'] || [];
      var userMessage = fields['message'] || '';

      console.log('=== PARSED FIELDS ===');
      console.log('Name:', name);
      console.log('Email:', email);
      console.log('Phone:', phone);
      console.log('Preferred Day:', preferredDay);
      console.log('Preferred Time:', preferredTime);
      console.log('Appointment Types:', JSON.stringify(appointmentTypes));
      console.log('Message:', userMessage);
      console.log('=====================');

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
              try {
                console.log('Found questionnaire file: ' + fileName + ' (id=' + file.getId() + ', size=' + file.getSize() + ')');
              } catch (logErr) { /* ignore logging errors */ }
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
      var subject = 'Welcome to Harborview Legal Group - Next Steps for Your Inquiry';
      var welcomeBody = 'Dear ' + name + ',\n\n' +
                        'Thank you for contacting us! We\'ve received your inquiry about: ' + appointmentTypes.join(', ') + '.\n' +
                        'Your preferred day and time: ' + preferredDay + ' ' + preferredTime + '.\n' +
                        'Your message: ' + userMessage + '\n\n' +
                        'Please answer the following questions to help us prepare for your consultation:\n\n' +
                        questionnaireContents +
                        'To schedule your consultation, please use this link: ' + CALENDLY_LINK + '\n\n' +
                        'Reply with your answers or contact us with any questions.\n\n' +
                        'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;

      console.log('Attempting to send email to: ' + email);
      try {
        // Send from the script owner's account; direct replies to YOUR_EMAIL
        GmailApp.sendEmail(email, subject, welcomeBody, { replyTo: YOUR_EMAIL });
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
      message.markRead();
      threads[i].addLabel(processedLabel);
    }
  }
}

/**
 * Parse the incoming POST event payload into an object.
 */
function _parsePostEvent(e) {
  // e.postData.contents contains raw body for JSON
  try {
    if (e.postData && e.postData.type && e.postData.type.indexOf('application/json') === 0) {
      return JSON.parse(e.postData.contents || '{}');
    }
  } catch (e) { /* ignore JSON parse errors */ }

  // If form-encoded, parameters will be in e.parameter
  if (e.parameter) {
    // Convert appointment_types from comma-separated string into array if present
    var params = {};
    for (var k in e.parameter) {
      if (!e.parameter.hasOwnProperty(k)) continue;
      var val = e.parameter[k];
      if (k === 'appointment_types' && typeof val === 'string') {
        params[k] = val.split(',').map(function(item) { return item.trim(); });
      } else {
        params[k] = val;
      }
    }
    return params;
  }

  return null;
}

/**
 * Normalize field names and types to those expected by the existing script.
 */
function _normalizeFields(payload) {
  var out = {};
  // normalize keys to lower-case snake_case equivalents used elsewhere
  out.name = payload.name || payload.full_name || payload['Full Name'] || payload['Name'] || '';
  out.email = payload.email || payload.email_address || payload['Email'] || '';
  out.phone = payload.phone || payload.phone_number || payload['Phone'] || '';
  out.preferred_day = payload.preferred_day || payload.preferredDay || payload['Preferred Day'] || '';
  out.preferred_time = payload.preferred_time || payload.preferredTime || payload['Preferred Time'] || '';
  var appts = payload.appointment_types || payload.appointmentTypes || payload['Appointment Types'] || payload.service || payload.services || '';
  if (Array.isArray(appts)) out.appointment_types = appts;
  else if (typeof appts === 'string' && appts.indexOf(',') !== -1) out.appointment_types = appts.split(',').map(function(i){return i.trim();});
  else if (typeof appts === 'string' && appts) out.appointment_types = [appts];
  else out.appointment_types = [];
  out.message = payload.message || payload.comments || payload['Message'] || '';
  return out;
}

/**
 * Simple global rate limiter using PropertiesService. Count events in a sliding window.
 * maxCount: maximum allowed events
 * windowMs: window size in milliseconds
 */
function _checkRateLimit(maxCount, windowMs) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'submission_timestamps';
    var raw = props.getProperty(key) || '';
    var now = Date.now();
    var arr = raw ? JSON.parse(raw) : [];
    // filter to keep timestamps inside window
    var windowStart = now - windowMs;
    arr = arr.filter(function(ts){ return ts > windowStart; });
    if (arr.length >= maxCount) {
      return false;
    }
    arr.push(now);
    props.setProperty(key, JSON.stringify(arr));
    return true;
  } catch (e) {
    // On error, fail open (allow) but log
    console.log('Rate limiter error: ' + e);
    return true;
  }
}

function doPost(e) {
  try {
    var payload = _parsePostEvent(e);
    if (!payload || !payload.email) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Missing required field: email' })).setMimeType(ContentService.MimeType.JSON).setHeaders({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      });
    }

    // Basic rate limiting (global) to reduce abuse: max 300 submissions per hour
    if (!_checkRateLimit(300, 60 * 60 * 1000)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Rate limit exceeded' })).setMimeType(ContentService.MimeType.JSON).setHeaders({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      });
    }

    var fields = _normalizeFields(payload);

    // Build questionnaire contents (best-effort)
    var questionnaireContents = '';
    var appointmentTypes = fields.appointment_types || [];
    var folder = null;
    try { folder = DriveApp.getFolderById(FOLDER_ID); } catch (err) { folder = null; }
    for (var m = 0; m < appointmentTypes.length; m++) {
      var type = appointmentTypes[m].trim();
      var fileName = QUESTIONNAIRE_FILES[type];
      if (fileName && folder) {
        try {
          var files = folder.getFilesByName(fileName);
          if (files.hasNext()) {
            var file = files.next();
            var content = file.getBlob().getDataAsString();
            questionnaireContents += type + ' Questionnaire\n\n' + content + '\n\n';
          } else {
            questionnaireContents += type + ' Questionnaire\n\nNo questionnaire available.\n\n';
          }
        } catch (e2) {
          questionnaireContents += type + ' Questionnaire\n\nError retrieving questionnaire.\n\n';
        }
      }
    }
    if (!questionnaireContents) questionnaireContents = 'No specific questionnaire available. Please reply for more details.\n\n';

    var name = fields.name || 'Unknown';
    var phone = fields.phone || '';
    var email = fields.email || '';
    var preferredDay = fields.preferred_day || 'Any';
    var preferredTime = fields.preferred_time || 'Any';
    var userMessage = fields.message || '';

    var subject = 'Welcome to Harborview Legal Group - Next Steps for Your Inquiry';
    var welcomeBody = 'Dear ' + name + ',\n\n' +
                      'Thank you for contacting us! We\'ve received your inquiry about: ' + appointmentTypes.join(', ') + '.\n' +
                      'Your preferred day and time: ' + preferredDay + ' ' + preferredTime + '.\n' +
                      'Your message: ' + userMessage + '\n\n' +
                      'Please answer the following questions to help us prepare for your consultation:\n\n' +
                      questionnaireContents +
                      'To schedule your consultation, please use this link: ' + CALENDLY_LINK + '\n\n' +
                      'Reply with your answers or contact us with any questions.\n\n' +
                      'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;

    // Send welcome email (fail fast)
    try {
      GmailApp.sendEmail(email, subject, welcomeBody, { replyTo: YOUR_EMAIL });
    } catch (e1) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Failed to send email' })).setMimeType(ContentService.MimeType.JSON).setHeaders({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type"
      });
    }

    // Log to Google Sheet (best-effort)
    try {
      var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
      var sheet = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Appointment Types', 'Message', 'Timestamp', 'Followed Up', 'ReminderSentAt', 'ThreadId', 'EventId', 'MatchMethod', 'ResponseReceived', 'ExecutiveSummary', 'QuestionnaireResponses', 'QuestionnaireParsed', 'Source']);
      } else {
        if (sheet.getLastColumn() < 18) {
          try { sheet.getRange(1, 18).setValue('Source'); } catch (e3) { /* ignore */ }
        }
      }
      var timestamp = new Date();
      sheet.appendRow([email, name, phone, preferredDay, preferredTime, (appointmentTypes || []).join(', '), userMessage, timestamp, false, '', '', '', '', false, '', questionnaireContents, false, 'Direct POST']);
    } catch (e4) {
      // ignore sheet errors in response
    }

    // Admin notification (best-effort)
    try {
      var adminSubject = 'New contact form submission for Harborview Legal Group';
      var adminBody = 'A new lead was received via Direct POST:\n\n' +
                      'Email: ' + email + '\n' +
                      'Name: ' + name + '\n' +
                      'Phone: ' + phone + '\n' +
                      'Appointment Types: ' + (appointmentTypes || []).join(', ') + '\n' +
                      'Preferred: ' + preferredDay + ' ' + preferredTime + '\n' +
                      'Message: ' + userMessage + '\n\n' +
                      'This notification was sent by the automated Apps Script endpoint.';
      GmailApp.sendEmail(YOUR_EMAIL, adminSubject, adminBody, { replyTo: YOUR_EMAIL });
    } catch (e5) {
      // ignore admin email errors in response
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON).setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unhandled error' })).setMimeType(ContentService.MimeType.JSON).setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type"
    });
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ message: "GET method not supported, use POST" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle CORS preflight OPTIONS requests
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}
