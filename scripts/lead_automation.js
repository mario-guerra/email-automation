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
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Appointment Types', 'Message', 'Timestamp', 'Followed Up']);
        }
        var timestamp = new Date();
        sheet.appendRow([email, name, phone, preferredDay, preferredTime, appointmentTypes.join(', '), userMessage, timestamp, false]);
        console.log('Logged to Sheet: ' + email);
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
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheet = ss.getSheetByName('Leads');
    var data = sheet.getDataRange().getValues();
    
    for (var row = 1; row < data.length; row++) {
      var email = data[row][0];
      var name = data[row][1];
      var timestamp = new Date(data[row][7]);
      var followedUp = data[row][8];
      
      if (followedUp) continue;
      
      var timeSince = (new Date() - timestamp) / (1000 * 60 * 60); // hours
      if (timeSince < 24) continue;
      
      // Check for replies
      var replySearch = GmailApp.search('from:' + email + ' after:' + Math.floor(timestamp.getTime() / 1000));
      if (replySearch.length > 0) {
        console.log('Reply found for: ' + email);
        sheet.getRange(row + 1, 9).setValue(true);
        continue;
      }
      
      // Send reminder
      var reminderSubject = 'Follow-Up Reminder: ' + name + ' (' + email + ')';
      var reminderBody = 'The lead ' + name + ' (' + email + ') has not responded within 24 hours.\n\nPlease follow up manually.';
      try {
        GmailApp.sendEmail(YOUR_EMAIL, reminderSubject, reminderBody);
        console.log('Reminder sent for: ' + email);
      } catch (e) {
        console.log('Failed to send reminder for: ' + email + ': ' + e);
        continue;
      }
      
      // Mark as followed up
      try {
        sheet.getRange(row + 1, 9).setValue(true);
        console.log('Marked as followed up: ' + email);
      } catch (e) {
        console.log('Failed to mark as followed up for: ' + email + ': ' + e);
      }
    }
  } catch (e) {
    console.log('Error in follow-up check: ' + e);
  }
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('processLeadEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  ScriptApp.newTrigger('checkFollowUps')
    .timeBased()
    .everyHours(1)
    .create();
}