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
    - AI_API_KEY (for Gemini API to generate executive summaries)

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
var AI_API_KEY = getConfigValue('AI_API_KEY');

// Validate required properties and exit with a clear error if any are missing.
(function validateConfig() {
  var missing = [];
  if (!CALENDLY_LINK) missing.push('CALENDLY_LINK');
  if (!LEAD_TRACKER_SHEET_ID) missing.push('LEAD_TRACKER_SHEET_ID');
  if (!YOUR_EMAIL) missing.push('YOUR_EMAIL');
  if (!FOLDER_ID) missing.push('FOLDER_ID');
  if (!AI_API_KEY) missing.push('AI_API_KEY');
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

function generateExecutiveSummary(emailContent) {
  console.log('Generating AI summary for email content length: ' + emailContent.length);
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + AI_API_KEY;
    var prompt = 'Summarize the key points from this lead\'s email response to our questionnaire. Focus on their answers, expressed concerns, overall sentiment, and highlight anything important for the lawyer to know prior to the call. Call out anything that merits a closer read of the email and/or questionnaire answers. Keep it under 200 words. Use "Important points:" for the highlighted section.\n\nEmail Content:\n' + emailContent;
    var payload = {
      'contents': [{
        'parts': [{
          'text': prompt
        }]
      }]
    };
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    console.log('Calling Gemini API...');
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
      var summary = json.candidates[0].content.parts[0].text.trim();
      console.log('AI summary generated successfully, length: ' + summary.length);
      return summary;
    } else {
      console.log('AI API error: Invalid response structure - ' + JSON.stringify(json));
      return 'Summary unavailable - manual review needed.';
    }
  } catch (e) {
    console.log('AI API error: ' + e);
    return 'Summary unavailable - manual review needed.';
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

    // Ensure headers exist (non-destructive)
    try {
      if (sheet.getLastColumn() < REMINDER_AT_COL) sheet.getRange(1, REMINDER_AT_COL).setValue('ReminderSentAt');
      if (sheet.getLastColumn() < THREAD_ID_COL) sheet.getRange(1, THREAD_ID_COL).setValue('ThreadId');
      if (sheet.getLastColumn() < EVENT_ID_COL) sheet.getRange(1, EVENT_ID_COL).setValue('EventId');
      if (sheet.getLastColumn() < MATCH_METHOD_COL) sheet.getRange(1, MATCH_METHOD_COL).setValue('MatchMethod');
      if (sheet.getLastColumn() < RESPONSE_RECEIVED_COL) sheet.getRange(1, RESPONSE_RECEIVED_COL).setValue('ResponseReceived');
      if (sheet.getLastColumn() < EXECUTIVE_SUMMARY_COL) sheet.getRange(1, EXECUTIVE_SUMMARY_COL).setValue('ExecutiveSummary');
      console.log('Headers ensured.');
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
  var responseReceivedRaw = data[row][13]; // New column
  var executiveSummaryCell = (data[row][14] || '').toString().trim(); // New column

        if (!email) {
          console.log('Row ' + (row + 1) + ': No email found, skipping.');
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
                      // Try to fetch email content for this event
                      if (threadIdCell) {
                        try {
                          var thread = GmailApp.getThreadById(threadIdCell);
                          if (thread && thread.getMessageCount > 1) {
                            var msgs = thread.getMessages();
                            for (var mi = 0; mi < msgs.length; mi++) {
                              if (msgs[mi].getDate().getTime() > timestamp.getTime()) {
                                replyContent = msgs[mi].getPlainBody();
                                console.log('Row ' + (row + 1) + ': Email content captured from thread.');
                                break;
                              }
                            }
                          }
                        } catch (e) {
                          console.log('Row ' + (row + 1) + ': Could not fetch email content from thread: ' + e.message);
                        }
                      }
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
                    matchedMethod = matchedMethod || 'threadid';
                    // if available, also record the thread id
                    matchedEventId = matchedEventId || thread.getId();
                    replyContent = msgs[mi].getPlainBody();
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
              matchedMethod = matchedMethod || 'gmail-search';
              // Get the latest message from the thread
              var foundMsgs = threadsFound[0].getMessages();
              if (foundMsgs && foundMsgs.length > 0) {
                replyContent = foundMsgs[foundMsgs.length - 1].getPlainBody();
                console.log('Row ' + (row + 1) + ': Reply found via Gmail search.');
              }
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
                          // Try to capture email content from the invitation message
                          replyContent = invMsg.getPlainBody();
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

        // If reply found but no content captured, try to fetch it
        if (replyFound && !replyContent) {
          console.log('Row ' + (row + 1) + ': Reply found but no content, attempting to fetch...');
          var afterEpoch = Math.floor(timestamp.getTime() / 1000);
          var query = 'from:"' + email + '" after:' + afterEpoch + ' in:anywhere';
          try {
            var threadsFound = GmailApp.search(query, 0, 1);
            if (threadsFound && threadsFound.length > 0) {
              var foundMsgs = threadsFound[0].getMessages();
              if (foundMsgs && foundMsgs.length > 0) {
                replyContent = foundMsgs[foundMsgs.length - 1].getPlainBody();
                console.log('Row ' + (row + 1) + ': Email content fetched via search.');
              }
            }
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Failed to fetch email content: ' + e.message);
          }
        }

        // If reply found and not already processed, generate executive summary
        if (replyFound && !responseReceived && replyContent) {
          console.log('Row ' + (row + 1) + ': Generating executive summary...');
          var summary = generateExecutiveSummary(replyContent);
          sheet.getRange(row + 1, RESPONSE_RECEIVED_COL).setValue(true);
          sheet.getRange(row + 1, EXECUTIVE_SUMMARY_COL).setValue(summary);
          sheet.getRange(row + 1, MATCH_METHOD_COL).setValue(matchedMethod); // Record how reply was detected
          sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true); // Mark as followed up
          console.log('Row ' + (row + 1) + ': Executive summary generated for ' + email);

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