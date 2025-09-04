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

  Triggers:
  - Call setupTriggers() to create the time-based triggers:
    - processLeadEmails: every 5 minutes
    - checkFollowUps: every hour

  Notes:
  - `checkFollowUps()` can use the Google Calendar API to detect scheduled events.
    Enable the Advanced Calendar service and the Google Calendar API in the linked GCP project
    if you want calendar-based detection.
  - The script writes metadata columns to the Leads sheet (ReminderSentAt, ThreadId, EventId, MatchMethod).
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

// Validate required properties and exit with a clear error if any are missing.
(function validateConfig() {
  var missing = [];
  if (!CALENDLY_LINK) missing.push('CALENDLY_LINK');
  if (!LEAD_TRACKER_SHEET_ID) missing.push('LEAD_TRACKER_SHEET_ID');
  if (!YOUR_EMAIL) missing.push('YOUR_EMAIL');
  if (!FOLDER_ID) missing.push('FOLDER_ID');
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
          sheet.appendRow(['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Appointment Types', 'Message', 'Timestamp', 'Followed Up', 'ReminderSentAt', 'ThreadId']);
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
        sheet.appendRow([email, name, phone, preferredDay, preferredTime, appointmentTypes.join(', '), userMessage, timestamp, false, '', threadId]);
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

function checkFollowUps() {
  console.log('Starting follow-up check...');
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

    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) {
      console.log('Leads sheet not found. Exiting.');
      return;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      console.log('No leads to process.');
      return;
    }

    // Column indices (1-based for sheet API)
    var FOLLOWED_UP_COL = 9;
    var REMINDER_AT_COL = 10;
    var THREAD_ID_COL = 11;
    var EVENT_ID_COL = 12;
    var MATCH_METHOD_COL = 13;

    // Ensure headers exist (non-destructive)
    try {
      if (sheet.getLastColumn() < REMINDER_AT_COL) sheet.getRange(1, REMINDER_AT_COL).setValue('ReminderSentAt');
      if (sheet.getLastColumn() < THREAD_ID_COL) sheet.getRange(1, THREAD_ID_COL).setValue('ThreadId');
      if (sheet.getLastColumn() < EVENT_ID_COL) sheet.getRange(1, EVENT_ID_COL).setValue('EventId');
      if (sheet.getLastColumn() < MATCH_METHOD_COL) sheet.getRange(1, MATCH_METHOD_COL).setValue('MatchMethod');
    } catch (e) {
      console.log('Could not ensure headers: ' + e);
    }

    for (var row = 1; row < data.length; row++) {
      try {
        var email = (data[row][0] || '').toString().trim();
        var name = (data[row][1] || '').toString().trim();
  var timestampRaw = data[row][7];
  var followedUpRaw = data[row][8];
  var threadIdCell = (data[row][10] || '').toString().trim();

        if (!email) {
          // nothing to do
          continue;
        }

        // Normalize followedUp value to boolean
        var followedUp = false;
        if (followedUpRaw === true) followedUp = true;
        else if (typeof followedUpRaw === 'string' && followedUpRaw.toLowerCase() === 'true') followedUp = true;
        else if (!isNaN(Number(followedUpRaw)) && Number(followedUpRaw) === 1) followedUp = true;

        if (followedUp) continue;

        var timestamp = new Date(timestampRaw);
        if (isNaN(timestamp.getTime())) {
          console.log('Invalid timestamp at row ' + (row + 1) + '. Skipping.');
          continue;
        }

        var hoursSince = (new Date().getTime() - timestamp.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) continue;

        var replyFound = false;
        var matchedEventId = '';
        var matchedMethod = '';

        // Primary: try Calendar API (Advanced service) to find events for YOUR_EMAIL
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
                      break;
                    }
                  }
                }
                if (replyFound) break;
              }
            }
          } catch (e) {
            // Advanced Calendar API might not be enabled or may error — fall through
            console.log('Calendar API error or not enabled: ' + e);
          }
        } catch (e) {
          console.log('Calendar API check failed: ' + e);
        }

        // Secondary: Prefer threadId-based detection if we saved it at logging time
        if (threadIdCell) {
          try {
            var thread = GmailApp.getThreadById(threadIdCell);
            if (thread && thread.getMessageCount && thread.getMessageCount() > 0) {
              // Check if there are messages in the thread after the original timestamp
              var msgs = thread.getMessages();
              for (var mi = 0; mi < msgs.length; mi++) {
                if (msgs[mi].getDate().getTime() > timestamp.getTime()) {
                  replyFound = true;
                  matchedMethod = matchedMethod || 'threadid';
                  // if available, also record the thread id
                  matchedEventId = matchedEventId || thread.getId();
                  break;
                }
              }
            }
          } catch (e) {
            // If thread lookup fails, fall back to search
            replyFound = false;
          }
        }
        // Tertiary: fallback to conservative Gmail search
        if (!replyFound) {
          var afterEpoch = Math.floor(timestamp.getTime() / 1000);
          var query = 'from:"' + email + '" after:' + afterEpoch + ' in:anywhere';
          try {
            var threadsFound = GmailApp.search(query, 0, 1);
            if (threadsFound && threadsFound.length > 0) {
              replyFound = true;
              matchedMethod = matchedMethod || 'gmail-search';
            }
          } catch (e) {
            console.log('Gmail search error for ' + email + ': ' + e);
          }
        }

        // Quaternary: scan recent Invitation emails for .ics attachments and parse attendees/UID
        if (!replyFound) {
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
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.log('Error scanning invites for ' + email + ': ' + e);
          }
        }

        // No reply found -> send gentle reminder to the lead
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
          console.log('Reminder sent to lead: ' + email + ' (row ' + (row + 1) + ')');
        } catch (e) {
          console.log('Failed to send reminder to lead ' + email + ': ' + e);
          // Fallback: notify the owner
          try {
            var fallbackSubject = 'Reminder Failed: ' + name + ' (' + email + ')';
            var fallbackBody = 'Failed to send reminder to lead ' + name + ' (' + email + '). Error: ' + e;
            GmailApp.sendEmail(YOUR_EMAIL, fallbackSubject, fallbackBody);
            console.log('Fallback notification sent to owner for ' + email);
          } catch (fallbackErr) {
            console.log('Failed to send fallback notification: ' + fallbackErr);
          }
          // Still mark as followed up to avoid retries
          sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
          sheet.getRange(row + 1, REMINDER_AT_COL).setValue(new Date());
        }
      } catch (rowErr) {
        console.log('Error processing row ' + (row + 1) + ': ' + rowErr);
        // continue to next row
      }
    }
  } catch (e) {
    console.log('Error in follow-up check: ' + e);
  } finally {
    try { lock.releaseLock(); } catch (releaseErr) { /* ignore */ }
  }
}
// End of file