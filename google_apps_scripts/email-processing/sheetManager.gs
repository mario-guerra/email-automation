/**
 * Sheet Manager Module
 * Handles all spreadsheet operations for leads management
 */

/**
 * Records a questionnaire response for a lead
 */
function markQuestionnaireResponse(email, parsedAtIso, parsedObj, cleanedText, executiveSummary, matchMethod) {
  if (!email) return { success: false, error: 'missing email' };
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) return { success: false, error: 'Leads sheet not found' };

    var lock = LockService.getScriptLock();
    try { lock.waitLock(5000); } catch (e) { /* continue without lock */ }

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 1) { try { lock.releaseLock(); } catch (e){}; return { success: false, error: 'Leads sheet empty' }; }
    var header = data[0] || [];

    // identify column indices (safely extend header if missing)
    var Q_RESP_COL = 'QuestionnaireResponses';
    var Q_PARSED_COL = 'QuestionnaireParsed';
    var RESP_RCVD_COL = 'ResponseReceived';
    var EXEC_SUM_COL = 'ExecutiveSummary';
    var MATCH_METHOD_COL_NAME = 'MatchMethod';

    var qRespIdx = header.indexOf(Q_RESP_COL);
    var qParsedIdx = header.indexOf(Q_PARSED_COL);
    var respRcvIdx = header.indexOf(RESP_RCVD_COL);
    var execIdx = header.indexOf(EXEC_SUM_COL);
    var matchIdx = header.indexOf(MATCH_METHOD_COL_NAME);
    var headerChanged = false;
    var newHeader = header.slice();
    if (qRespIdx === -1) { newHeader.push(Q_RESP_COL); qRespIdx = newHeader.length - 1; headerChanged = true; }
    if (qParsedIdx === -1) { newHeader.push(Q_PARSED_COL); qParsedIdx = newHeader.length - 1; headerChanged = true; }
    if (respRcvIdx === -1) { newHeader.push(RESP_RCVD_COL); respRcvIdx = newHeader.length - 1; headerChanged = true; }
    if (execIdx === -1) { newHeader.push(EXEC_SUM_COL); execIdx = newHeader.length - 1; headerChanged = true; }
    if (matchIdx === -1) { newHeader.push(MATCH_METHOD_COL_NAME); matchIdx = newHeader.length - 1; headerChanged = true; }
    if (headerChanged) { sheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]); header = newHeader; }

    // find row
    var targetRowIndex = -1;
    var lookupEmail = email.toString().trim().toLowerCase();
    for (var r = 1; r < data.length; r++) {
      if ((data[r][0] || '').toString().trim().toLowerCase() === lookupEmail) { targetRowIndex = r; break; }
    }
    if (targetRowIndex === -1) { try { lock.releaseLock(); } catch (e){}; return { success: false, error: 'lead not found' }; }

    var sheetRow = targetRowIndex + 1;
    try {
      if (cleanedText !== undefined && cleanedText !== null) sheet.getRange(sheetRow, qRespIdx + 1).setValue(cleanedText);
      try { sheet.getRange(sheetRow, qParsedIdx + 1).setValue(JSON.stringify(parsedObj || {})); } catch (e) { /* ignore parse write */ }
      sheet.getRange(sheetRow, respRcvIdx + 1).setValue(true);
      if (executiveSummary !== undefined && executiveSummary !== null) sheet.getRange(sheetRow, execIdx + 1).setValue(executiveSummary);
      if (matchMethod) sheet.getRange(sheetRow, matchIdx + 1).setValue(matchMethod);
    } catch (writeErr) {
      try { lock.releaseLock(); } catch (e){}
      return { success: false, error: writeErr.toString() };
    }

    try { lock.releaseLock(); } catch (e) {}
    return { success: true, row: sheetRow };
  } catch (e) {
    try { LockService.getScriptLock().releaseLock(); } catch (ee) {}
    return { success: false, error: e.toString() };
  }
}

/**
 * Records a calendar invite for a lead
 */
function recordCalendarInvite(email, scheduledAtIso, calendarEventId) {
  if (!email) {
    console.log('recordCalendarInvite called without email');
    return { success: false, error: 'missing email' };
  }

  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    console.log('recordCalendarInvite: spreadsheet=' + ss.getUrl());
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) {
      console.log('recordCalendarInvite: Leads sheet not found');
      return { success: false, error: 'Leads sheet not found' };
    }

    var lock = LockService.getScriptLock();
    try { lock.waitLock(5000); } catch (e) { console.log('recordCalendarInvite: could not obtain lock: ' + e); }

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 1) {
      try { lock.releaseLock(); } catch (e) {}
      return { success: false, error: 'Leads sheet appears empty' };
    }

    var header = data[0] || [];

    // Find the row by email (column A)
    var targetRowIndex = -1;
    var lookupEmail = email.toString().trim().toLowerCase();
    for (var r = 1; r < data.length; r++) {
      var cellEmail = (data[r][0] || '').toString().trim().toLowerCase();
      if (cellEmail === lookupEmail) { targetRowIndex = r; break; }
    }

    if (targetRowIndex === -1) {
      console.log('recordCalendarInvite: lead not found for email=' + email);
      try { lock.releaseLock(); } catch (e) {}
      return { success: false, error: 'lead not found' };
    }

    // Ensure header columns exist: CalendarScheduledAt, CalendarEventId
    var CAL_COL = 'CalendarScheduledAt';
    var EVT_COL = 'CalendarEventId';
    var calIdx = header.indexOf(CAL_COL);
    var evtIdx = header.indexOf(EVT_COL);

    // If header missing, append columns to the header row
    if (calIdx === -1 || evtIdx === -1) {
      var newHeader = header.slice();
      if (calIdx === -1) { newHeader.push(CAL_COL); calIdx = newHeader.length - 1; }
      if (evtIdx === -1) { newHeader.push(EVT_COL); evtIdx = newHeader.length - 1; }
      sheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      header = newHeader;
      console.log('recordCalendarInvite: updated header with calendar columns');
    }

    // Parse scheduledAtIso to Date if provided
    var scheduledDate = null;
    if (scheduledAtIso) {
      if (typeof scheduledAtIso === 'number') {
        scheduledDate = new Date(scheduledAtIso);
      } else {
        scheduledDate = new Date(scheduledAtIso);
      }
      if (isNaN(scheduledDate.getTime())) {
        scheduledDate = new Date();
      }
    } else {
      scheduledDate = new Date();
    }

    // Write values to the found row (sheet rows are 1-based; data array is 0-based)
    var sheetRow = targetRowIndex + 1;
    try {
      sheet.getRange(sheetRow, calIdx + 1).setValue(scheduledDate);
      if (calendarEventId) sheet.getRange(sheetRow, evtIdx + 1).setValue(calendarEventId);
      console.log('recordCalendarInvite: wrote scheduled date to row ' + sheetRow);
    } catch (writeErr) {
      console.log('recordCalendarInvite: write error: ' + writeErr);
      try { lock.releaseLock(); } catch (e) {}
      return { success: false, error: writeErr.toString() };
    }

    try { lock.releaseLock(); } catch (e) {}
    return { success: true, row: sheetRow };
  } catch (e) {
    console.log('recordCalendarInvite: exception: ' + e);
    try { LockService.getScriptLock().releaseLock(); } catch (releaseErr) { /* ignore */ }
    return { success: false, error: e.toString() };
  }
}
