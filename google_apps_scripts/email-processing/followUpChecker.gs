/**
 * Follow-up Checker Module
 * Handles follow-up detection, reminders, and response processing
 */

var AI_API_KEY = getConfigValue('AI_API_KEY');
var ENABLE_AI_SUMMARY = getConfigValue('ENABLE_AI_SUMMARY') === 'true';

/**
 * Main function to check for follow-ups and send reminders
 */
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

        // Check if we have calendar scheduled data
        var calendarScheduledAt = null;
        try {
          var calSchedIdx = header.indexOf('CalendarScheduledAt');
          if (calSchedIdx !== -1 && data[row].length > calSchedIdx) {
            var calSchedRaw = data[row][calSchedIdx];
            if (calSchedRaw && calSchedRaw !== '') {
              calendarScheduledAt = new Date(calSchedRaw);
              if (isNaN(calendarScheduledAt.getTime())) calendarScheduledAt = null;
            }
          }
        } catch (e) {
          calendarScheduledAt = null;
        }

        // Determine if lead has completed both required actions
        var hasResponded = responseReceived;
        var hasScheduled = calendarScheduledAt !== null;
        var fullyFollowedUp = hasResponded && hasScheduled;

        // Skip if already fully followed up
        if (fullyFollowedUp) {
          console.log('Row ' + (row + 1) + ': Already fully followed up (responded: ' + hasResponded + ', scheduled: ' + hasScheduled + ') — will still check for updates.');
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
        var matchedEvent = null; // Calendar API event object when available
        var matchedEventStart = null; // Date extracted from ICS or event.start
        var replyContent = '';

        // [Rest of the follow-up detection logic would go here - truncated for brevity]
        // This includes Calendar API checks, Gmail searches, ICS parsing, Calendly detection, etc.

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
          // Write results via helper so we record questionnaire response atomically and idempotently
          try {
            // attempt to extract client name from parsed fields / sheet-provided name / reply heuristics
            var clientName = extractClientName(parsed || {}, name, replyContent, email);
            var summary = ENABLE_AI_SUMMARY ? generateExecutiveSummary(replyContent, clientName) : 'AI Summary disabled';
            if (ENABLE_AI_SUMMARY && (!summary || summary.indexOf('Summary unavailable') === 0)) {
              var fallback = buildSummaryFromParsed(parsed || {});
              if (fallback) summary = 'Auto-summary: ' + fallback;
            }
            var markRc = markQuestionnaireResponse(email, new Date().toISOString(), parsed || {}, cleanedForSheet || replyContent.trim(), summary, matchedMethod);
            console.log('Row ' + (row + 1) + ': markQuestionnaireResponse result: ' + JSON.stringify(markRc));
            if (markRc && markRc.success) {
              processedEmails.add(email.toLowerCase());
              // Track that this lead has responded to questionnaire
              hasResponded = true;
              // Only mark as fully followed up if both questionnaire response AND appointment are complete
              if (hasResponded && hasScheduled && !fullyFollowedUp) {
                sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
                console.log('Row ' + (row + 1) + ': Marked as fully followed up - both questionnaire and appointment completed');
              } else if (hasResponded && !hasScheduled) {
                console.log('Row ' + (row + 1) + ': Questionnaire response recorded, but waiting for calendar appointment before marking fully followed up');
              }
            }
          } catch (mqe) {
            console.log('Row ' + (row + 1) + ': markQuestionnaireResponse failed: ' + mqe);
          }

          // Send thank you email
          var thankYouSubject = 'Thank You for Your Response - Guerra Law Firm';
          var thankYouBody = 'Dear ' + name + ',\n\n' +
                             'Thank you for taking the time to respond to our questionnaire. We appreciate your cooperation and look forward to assisting you with your legal needs.\n\n' +
                             'We will review your responses and prepare for our consultation. If you have any additional questions or need to update your information, please reply to this email.\n\n' +
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

        // No reply found -> send targeted reminder based on partial completion status
        if (!replyFound) {
          var hoursSince = (new Date().getTime() - timestamp.getTime()) / (1000 * 60 * 60);
          console.log('Row ' + (row + 1) + ': Hours since contact: ' + hoursSince.toFixed(2));

          if (hoursSince < 24) {
            console.log('Row ' + (row + 1) + ': Too recent (<24h), skipping reminder.');
            continue;
          }

          console.log('Row ' + (row + 1) + ': No reply found, sending targeted reminder...');

          var reminderSubject, reminderBody;

          // Send targeted reminder based on what action is missing
          if (hasResponded && !hasScheduled) {
            // They responded but haven't scheduled - remind them to schedule
            reminderSubject = 'Next Step: Schedule Your Consultation - Guerra Law Firm';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'Thank you for completing our questionnaire. We\'ve received your responses and are ready to proceed.\n\n' +
                           'The next step is to schedule your consultation. Please use this link to choose a convenient time: ' + CALENDLY_LINK + '.\n\n' +
                           'We look forward to speaking with you soon.\n\n' +
                           'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
          } else if (hasScheduled && !hasResponded) {
            // They scheduled but haven't responded - remind them to complete questionnaire
            reminderSubject = 'Please Complete Your Questionnaire - Guerra Law Firm';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'We noticed you\'ve scheduled a consultation with us, which is great! To help us prepare effectively for our meeting, please take a few minutes to complete the questionnaire we sent earlier.\n\n' +
                           'You should have received an email with the questionnaire. If you need it resent or have any questions, please reply to this email.\n\n' +
                           'Thank you for your cooperation.\n\n' +
                           'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
          } else {
            // Neither action completed - send general reminder
            reminderSubject = 'Gentle Reminder: Follow Up on Your Inquiry with Guerra Law Firm';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'This is a gentle reminder about your recent inquiry with Guerra Law Firm.\n\n' +
                           'To help us prepare for your consultation, please take a moment to answer the questions we sent in our previous email and schedule a convenient time using this link: ' + CALENDLY_LINK + '.\n\n' +
                           'We look forward to hearing from you soon.\n\n' +
                           'Best regards,\nMario Guerra\nGuerra Law Firm\n' + YOUR_EMAIL;
          }

          try {
            GmailApp.sendEmail(email, reminderSubject, reminderBody, { from: YOUR_EMAIL });
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);
            sheet.getRange(row + 1, REMINDER_AT_COL).setValue(new Date());
            console.log('Row ' + (row + 1) + ': Targeted reminder sent to lead: ' + email);
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
            // Still mark as followed up to prevent retries
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
