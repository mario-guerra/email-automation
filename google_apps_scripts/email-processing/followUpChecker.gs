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
          // Get header row to find CalendarScheduledAt column
          var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          var calSchedIdx = headerRow.indexOf('CalendarScheduledAt');
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

        // [Rest of the follow-up detection logic - IMPLEMENTED]
        // This includes Gmail search for reply detection

        // Method 1: Gmail reply detection - search for replies from the lead
        try {
          console.log('Row ' + (row + 1) + ': Checking for Gmail replies from ' + email);

          // Search for emails from this lead in the last 30 days
          var searchQuery = 'from:' + email + ' newer_than:30d';
          var replyThreads = GmailApp.search(searchQuery);

          console.log('Row ' + (row + 1) + ': Found ' + replyThreads.length + ' threads from ' + email);

          for (var t = 0; t < replyThreads.length && !replyFound; t++) {
            var thread = replyThreads[t];
            var messages = thread.getMessages();

            // Check if this thread is related to our original email (by checking thread ID if available)
            var threadMatches = false;
            var threadPriority = 'low'; // low, medium, high priority for processing

            if (threadIdCell && threadIdCell !== '') {
              // If we have the original thread ID, this is highest priority
              if (thread.getId() === threadIdCell) {
                threadMatches = true;
                threadPriority = 'high';
                console.log('Row ' + (row + 1) + ': Found matching thread by ID: ' + threadIdCell);
              }
            }

            // If we don't have a thread ID match, check subject for questionnaire-related keywords
            if (!threadMatches) {
              var subject = thread.getFirstMessageSubject().toLowerCase();
              if (subject.includes('harborview') || subject.includes('questionnaire') ||
                  subject.includes('consultation') || subject.includes('legal') ||
                  subject.includes('re:') || subject.includes('fwd:')) {
                threadMatches = true;
                threadPriority = 'medium';
                console.log('Row ' + (row + 1) + ': Found potential matching thread by subject: ' + subject);
              }
            }

            // If still no match, check if this thread contains any recent messages from the lead
            // This catches replies in threads we might not have anticipated
            if (!threadMatches) {
              var hasRecentMessage = false;
              for (var m = 0; m < messages.length; m++) {
                var msgDate = messages[m].getDate();
                if (msgDate > timestamp) {
                  hasRecentMessage = true;
                  break;
                }
              }
              if (hasRecentMessage) {
                threadMatches = true;
                threadPriority = 'low';
                console.log('Row ' + (row + 1) + ': Found thread with recent messages from lead');
              }
            }

            if (threadMatches) {
              console.log('Row ' + (row + 1) + ': Processing thread (priority: ' + threadPriority + ') with ' + messages.length + ' messages');

              // Look for the most recent message in this thread (likely the reply)
              for (var m = messages.length - 1; m >= 0 && !replyFound; m--) {
                var message = messages[m];
                var messageDate = message.getDate();

                // Only consider messages after the lead was contacted
                if (messageDate > timestamp) {
                  var plainBody = message.getPlainBody();
                  console.log('Row ' + (row + 1) + ': Checking message dated ' + messageDate + ', body length: ' + (plainBody ? plainBody.length : 0));

                  if (plainBody && plainBody.trim().length > 10) { // Ignore very short messages
                    // Additional check: look for questionnaire-like content
                    var bodyLower = plainBody.toLowerCase();
                    var hasQuestionnaireContent = false;

                    // Check for common questionnaire response patterns
                    if (bodyLower.includes('questionnaire') ||
                        bodyLower.includes('answers') ||
                        bodyLower.includes('response') ||
                        bodyLower.includes('information') ||
                        bodyLower.includes('details') ||
                        bodyLower.includes('form') ||
                        bodyLower.includes('completed') ||
                        bodyLower.includes('submitted') ||
                        // Check for question-answer patterns
                        (bodyLower.includes('?') && bodyLower.includes(':')) ||
                        // Check for numbered responses
                        /\d+\./.test(bodyLower) ||
                        // Check for common legal terms that might appear in responses
                        (bodyLower.includes('estate') || bodyLower.includes('probate') ||
                         bodyLower.includes('business') || bodyLower.includes('traffic') ||
                         bodyLower.includes('criminal') || bodyLower.includes('legal'))) {
                      hasQuestionnaireContent = true;
                    }

                    // For high priority threads, be less strict about content
                    // For medium/low priority threads, require questionnaire-like content
                    if (threadPriority === 'high' || hasQuestionnaireContent) {
                      console.log('Row ' + (row + 1) + ': Found reply message dated ' + messageDate + ' (priority: ' + threadPriority + ', hasContent: ' + hasQuestionnaireContent + ')');
                      replyFound = true;
                      matchedMethod = 'gmail_reply';
                      replyContent = plainBody.trim();
                      break;
                    } else {
                      // Special case: if message is very recent (within 3 days) and substantial,
                      // accept it even without questionnaire patterns as a fallback
                      var daysSinceMessage = (new Date().getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24);
                      if (daysSinceMessage <= 3 && plainBody.trim().length > 50) {
                        console.log('Row ' + (row + 1) + ': Found recent substantial message (fallback), dated ' + messageDate + ' (' + daysSinceMessage.toFixed(1) + ' days ago)');
                        replyFound = true;
                        matchedMethod = 'gmail_reply_fallback';
                        replyContent = plainBody.trim();
                        break;
                      } else {
                        console.log('Row ' + (row + 1) + ': Message has content but no questionnaire patterns, skipping');
                      }
                    }
                  } else {
                    console.log('Row ' + (row + 1) + ': Message too short or empty, skipping');
                  }
                } else {
                  console.log('Row ' + (row + 1) + ': Message predates contact (' + messageDate + ' vs ' + timestamp + '), skipping');
                }
              }
            } else {
              console.log('Row ' + (row + 1) + ': Thread does not match criteria, skipping');
            }
          }

          if (replyFound) {
            console.log('Row ' + (row + 1) + ': Reply detected via Gmail search, content length: ' + replyContent.length);
          } else {
            console.log('Row ' + (row + 1) + ': No Gmail replies found for ' + email);
          }

        } catch (gmailErr) {
          console.log('Row ' + (row + 1) + ': Error during Gmail reply detection: ' + gmailErr);
        }

        // Method 2: Calendar API detection - check for scheduled appointments
        if (!replyFound) {
          try {
            console.log('Row ' + (row + 1) + ': Checking Calendar API for appointments from ' + email);

            // Search for calendar events in the next 90 days that might be related to this lead
            var calendar = CalendarApp.getDefaultCalendar();
            var now = new Date();
            var futureDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days from now

            var events = calendar.getEvents(now, futureDate);

            console.log('Row ' + (row + 1) + ': Found ' + events.length + ' upcoming calendar events');

            for (var e = 0; e < events.length && !replyFound; e++) {
              var event = events[e];
              var eventTitle = event.getTitle().toLowerCase();
              var eventDescription = (event.getDescription() || '').toLowerCase();
              var guestList = event.getGuestList();

              // Check if this event is related to the lead
              var eventMatchesLead = false;

              // Check guest list for the lead's email
              for (var g = 0; g < guestList.length; g++) {
                if (guestList[g].getEmail().toLowerCase() === email.toLowerCase()) {
                  eventMatchesLead = true;
                  console.log('Row ' + (row + 1) + ': Found calendar event with lead as guest: ' + event.getTitle());
                  break;
                }
              }

              // Also check event title and description for lead's name or email
              if (!eventMatchesLead) {
                if (eventTitle.includes(name.toLowerCase()) ||
                    eventDescription.includes(email.toLowerCase()) ||
                    eventDescription.includes(name.toLowerCase())) {
                  eventMatchesLead = true;
                  console.log('Row ' + (row + 1) + ': Found calendar event mentioning lead in title/description: ' + event.getTitle());
                }
              }

              // Check if event is legal/consultation related
              var isLegalEvent = false;
              if (eventTitle.includes('legal') || eventTitle.includes('consultation') ||
                  eventTitle.includes('meeting') || eventTitle.includes('harborview') ||
                  eventDescription.includes('legal') || eventDescription.includes('consultation')) {
                isLegalEvent = true;
              }

              if (eventMatchesLead && isLegalEvent) {
                console.log('Row ' + (row + 1) + ': Found matching legal consultation event: ' + event.getTitle() + ' at ' + event.getStartTime());
                replyFound = true;
                matchedMethod = 'calendar_api';
                matchedEvent = event;
                matchedEventId = event.getId();
                matchedEventStart = event.getStartTime();

                // For calendar events, we don't have reply content, but we can create a summary
                replyContent = 'Calendar appointment scheduled: ' + event.getTitle() + ' on ' + matchedEventStart.toLocaleDateString() + ' at ' + matchedEventStart.toLocaleTimeString();
                break;
              }
            }

            if (!replyFound) {
              console.log('Row ' + (row + 1) + ': No matching calendar events found for ' + email);
            }

          } catch (calErr) {
            console.log('Row ' + (row + 1) + ': Error during Calendar API detection: ' + calErr);
          }
        }

        // Method 3: ICS attachment parsing - check for calendar invites in emails
        if (!replyFound) {
          try {
            console.log('Row ' + (row + 1) + ': Checking for ICS attachments from ' + email);

            // Search for emails with ICS attachments from this lead
            var icsQuery = 'from:' + email + ' filename:ics newer_than:30d';
            var icsThreads = GmailApp.search(icsQuery);

            console.log('Row ' + (row + 1) + ': Found ' + icsThreads.length + ' threads with ICS attachments from ' + email);

            for (var t = 0; t < icsThreads.length && !replyFound; t++) {
              var thread = icsThreads[t];
              var messages = thread.getMessages();

              for (var m = messages.length - 1; m >= 0 && !replyFound; m--) {
                var message = messages[m];
                var messageDate = message.getDate();

                // Only consider messages after the lead was contacted
                if (messageDate > timestamp) {
                  var attachments = message.getAttachments();

                  for (var a = 0; a < attachments.length && !replyFound; a++) {
                    var attachment = attachments[a];
                    if (attachment.getName().toLowerCase().endsWith('.ics')) {
                      console.log('Row ' + (row + 1) + ': Found ICS attachment: ' + attachment.getName());

                      try {
                        var icsContent = attachment.getDataAsString();
                        var eventStart = parseICSEventStart(icsContent);

                        if (eventStart) {
                          console.log('Row ' + (row + 1) + ': Successfully parsed ICS event start: ' + eventStart);
                          replyFound = true;
                          matchedMethod = 'ics_attachment';
                          matchedEventStart = eventStart;
                          replyContent = 'Calendar invite received via ICS attachment for ' + eventStart.toLocaleDateString() + ' at ' + eventStart.toLocaleTimeString();
                          break;
                        }
                      } catch (icsParseErr) {
                        console.log('Row ' + (row + 1) + ': Error parsing ICS attachment: ' + icsParseErr);
                      }
                    }
                  }
                }
              }
            }

            if (!replyFound) {
              console.log('Row ' + (row + 1) + ': No valid ICS attachments found for ' + email);
            }

          } catch (icsErr) {
            console.log('Row ' + (row + 1) + ': Error during ICS attachment detection: ' + icsErr);
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
          var thankYouSubject = 'Thank You for Your Response - Harborview Legal Group';
          var thankYouBody = 'Dear ' + name + ',\n\n' +
                             'Thank you for taking the time to respond to our questionnaire. We appreciate your cooperation and look forward to assisting you with your legal needs.\n\n' +
                             'We will review your responses and prepare for our consultation. If you have any additional questions or need to update your information, please reply to this email.\n\n' +
                             'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;
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

          // Prevent sending more than one reminder: check if a reminder timestamp already exists
          try {
            var reminderCell = data[row].length > (REMINDER_AT_COL - 1) ? data[row][REMINDER_AT_COL - 1] : null;
            if (reminderCell && reminderCell !== '') {
              console.log('Row ' + (row + 1) + ': Reminder already sent at ' + reminderCell + ' — skipping further reminders.');
              continue;
            }
          } catch (remCheckErr) {
            // If anything goes wrong reading the cell, proceed cautiously (do not send duplicate reminders without timestamp)
            console.log('Row ' + (row + 1) + ': Error checking reminder cell: ' + remCheckErr + ' — proceeding with reminder checks.');
          }

          if (hoursSince < 24) {
            console.log('Row ' + (row + 1) + ': Too recent (<24h), skipping reminder.');
            continue;
          }

          console.log('Row ' + (row + 1) + ': No reply found, sending targeted reminder...');

          var reminderSubject, reminderBody;

          // Send targeted reminder based on what action is missing
          if (hasResponded && !hasScheduled) {
            // They responded but haven't scheduled - remind them to schedule
            reminderSubject = 'Next Step: Schedule Your Consultation - Harborview Legal Group';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'Thank you for completing our questionnaire. We\'ve received your responses and are ready to proceed.\n\n' +
                           'The next step is to schedule your consultation. Please use this link to choose a convenient time: ' + CALENDLY_LINK + '.\n\n' +
                           'We look forward to speaking with you soon.\n\n' +
                           'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;
          } else if (hasScheduled && !hasResponded) {
            // They scheduled but haven't responded - remind them to complete questionnaire
            reminderSubject = 'Please Complete Your Questionnaire - Harborview Legal Group';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'We noticed you\'ve scheduled a consultation with us, which is great! To help us prepare effectively for our meeting, please take a few minutes to complete the questionnaire we sent earlier.\n\n' +
                           'You should have received an email with the questionnaire. If you need it resent or have any questions, please reply to this email.\n\n' +
                           'Thank you for your cooperation.\n\n' +
                           'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;
          } else {
            // Neither action completed - send general reminder
            reminderSubject = 'Gentle Reminder: Follow Up on Your Inquiry with Harborview Legal Group';
            reminderBody = 'Dear ' + name + ',\n\n' +
                           'This is a gentle reminder about your recent inquiry with Harborview Legal Group.\n\n' +
                           'To help us prepare for your consultation, please take a moment to answer the questions we sent in our previous email and schedule a convenient time using this link: ' + CALENDLY_LINK + '.\n\n' +
                           'We look forward to hearing from you soon.\n\n' +
                           'Best regards,\nMax Powers\nHarborview Legal Group\n' + YOUR_EMAIL;
          }

          try {
            // Atomic write: record reminder timestamp and mark as followed-up BEFORE sending.
            // This prevents duplicate reminders if a subsequent sheet write fails.
            var now = new Date();
            sheet.getRange(row + 1, REMINDER_AT_COL).setValue(now);
            sheet.getRange(row + 1, FOLLOWED_UP_COL).setValue(true);

            GmailApp.sendEmail(email, reminderSubject, reminderBody, { from: YOUR_EMAIL });
            console.log('Row ' + (row + 1) + ': Targeted reminder sent to lead: ' + email);
          } catch (e) {
            console.log('Row ' + (row + 1) + ': Failed to send reminder to lead ' + email + ': ' + e);
            // Notify the owner about the failure. Leave ReminderSentAt set to avoid duplicate sends;
            // manual intervention is preferred if delivery repeatedly fails.
            try {
              var fallbackSubject = 'Reminder Failed: ' + name + ' (' + email + ')';
              var fallbackBody = 'Failed to send reminder to lead ' + name + ' (' + email + '). Error: ' + e;
              GmailApp.sendEmail(YOUR_EMAIL, fallbackSubject, fallbackBody);
              console.log('Row ' + (row + 1) + ': Fallback notification sent to owner for ' + email);
            } catch (fallbackErr) {
              console.log('Row ' + (row + 1) + ': Failed to send fallback notification: ' + fallbackErr);
            }
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

/**
 * Parse ICS content to extract event start time
 * @param {string} icsContent - The ICS file content
 * @returns {Date|null} - The event start date/time or null if parsing fails
 */
function parseICSEventStart(icsContent) {
  try {
    if (!icsContent || typeof icsContent !== 'string') {
      return null;
    }

    // Look for DTSTART line in ICS content
    var lines = icsContent.split('\n');
    var dtStart = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.toUpperCase().startsWith('DTSTART')) {
        // Extract the date/time value
        var colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          dtStart = line.substring(colonIndex + 1).trim();
          break;
        }
      }
    }

    if (!dtStart) {
      console.log('No DTSTART found in ICS content');
      return null;
    }

    console.log('Found DTSTART in ICS: ' + dtStart);

    // Parse different ICS date formats
    var eventDate = null;

    // Format: 20231201T100000Z (UTC)
    if (dtStart.length === 16 && dtStart.endsWith('Z')) {
      var year = dtStart.substring(0, 4);
      var month = dtStart.substring(4, 6);
      var day = dtStart.substring(6, 8);
      var hour = dtStart.substring(9, 11);
      var minute = dtStart.substring(11, 13);
      var second = dtStart.substring(13, 15);

      eventDate = new Date(Date.UTC(
        parseInt(year), parseInt(month) - 1, parseInt(day),
        parseInt(hour), parseInt(minute), parseInt(second)
      ));
    }
    // Format: 20231201T100000 (local time, assume UTC for simplicity)
    else if (dtStart.length === 15) {
      var year = dtStart.substring(0, 4);
      var month = dtStart.substring(4, 6);
      var day = dtStart.substring(6, 8);
      var hour = dtStart.substring(9, 11);
      var minute = dtStart.substring(11, 13);
      var second = dtStart.substring(13, 15);

      eventDate = new Date(
        parseInt(year), parseInt(month) - 1, parseInt(day),
        parseInt(hour), parseInt(minute), parseInt(second)
      );
    }
    // Format: 20231201 (date only)
    else if (dtStart.length === 8) {
      var year = dtStart.substring(0, 4);
      var month = dtStart.substring(4, 6);
      var day = dtStart.substring(6, 8);

      eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    if (eventDate && !isNaN(eventDate.getTime())) {
      console.log('Successfully parsed ICS date: ' + eventDate.toISOString());
      return eventDate;
    } else {
      console.log('Failed to parse ICS date: ' + dtStart);
      return null;
    }

  } catch (e) {
    console.log('Error parsing ICS content: ' + e);
    return null;
  }
}
