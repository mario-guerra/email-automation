/**
 * Archive Manager Module
 * Handles lead archiving, deletion, and cleanup operations
 */

/**
 * Deletes a lead row from the Leads sheet by email.
 */
function deleteLead(email) {
  if (!email) {
    console.log('deleteLead called without email');
    return false;
  }

  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    console.log('deleteLead: spreadsheet url=' + ss.getUrl() + ' id=' + ss.getId());
    var leadsSheet = ss.getSheetByName('Leads');
    if (!leadsSheet) {
      console.log('deleteLead: Leads sheet not found');
      return false;
    }

    var lock = LockService.getScriptLock();
    try { lock.waitLock(5000); } catch (e) { console.log('deleteLead: could not obtain lock: ' + e); }

    var dataRange = leadsSheet.getDataRange();
    var values = dataRange.getValues();

    // Find matching row (first occurrence) by email in column A
    var targetRowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      var cellEmail = (values[i][0] || '').toString().trim().toLowerCase();
      if (cellEmail === email.toString().trim().toLowerCase()) { targetRowIndex = i; break; }
    }

    if (targetRowIndex === -1) {
      console.log('deleteLead: email not found: ' + email);
      try { lock.releaseLock(); } catch (e) {}
      return false;
    }

    // Prepare archive sheet
    var archiveSheetName = 'Archive';
    var archiveSheet = ss.getSheetByName(archiveSheetName);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(archiveSheetName);
      console.log('deleteLead: created Archive sheet');
    }

    // Ensure header exists on archive sheet (copy from leads or create)
    var header = values[0] || [];
    var ARCHIVE_COL_NAME = 'ArchivedAt';
    var archiveHeader = archiveSheet.getLastRow() >= 1 ? archiveSheet.getRange(1, 1, 1, Math.max(archiveSheet.getLastColumn(), header.length)).getValues()[0] : [];
    if (!archiveHeader || archiveHeader.length === 0) {
      var newHeader = header.slice();
      newHeader.push(ARCHIVE_COL_NAME);
      archiveSheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      archiveHeader = newHeader;
      console.log('deleteLead: wrote header to Archive: ' + JSON.stringify(newHeader));
    } else if (archiveHeader.indexOf(ARCHIVE_COL_NAME) === -1) {
      archiveSheet.getRange(1, archiveHeader.length + 1).setValue(ARCHIVE_COL_NAME);
      archiveHeader.push(ARCHIVE_COL_NAME);
      console.log('deleteLead: appended ArchivedAt to Archive header');
    }

    // Read the full row to archive
    var rowValues = values[targetRowIndex].slice();
    rowValues.push(new Date()); // ArchivedAt
    console.log('deleteLead: rowValues to append length=' + rowValues.length + ' values=' + JSON.stringify(rowValues));

    // Ensure rowValues matches archive header length (pad if necessary)
    var targetLen = Math.max(archiveHeader.length, rowValues.length);
    while (rowValues.length < targetLen) rowValues.push('');

    // Append to archive sheet with error handling — do not delete original unless append succeeds
    try {
      archiveSheet.appendRow(rowValues);
      console.log('deleteLead: appendRow succeeded to Archive sheet');
    } catch (appendErr) {
      console.log('deleteLead: appendRow failed: ' + appendErr);
      try { lock.releaseLock(); } catch (e) {}
      return false;
    }

    // Delete original row from leads (adjust for 1-based sheet rows)
    leadsSheet.deleteRow(targetRowIndex + 1);

    try { lock.releaseLock(); } catch (e) {}
    console.log('deleteLead: archived and removed lead: ' + email);
    return true;
  } catch (e) {
    console.log('deleteLead: exception: ' + e);
    try { LockService.getScriptLock().releaseLock(); } catch (releaseErr) { /* ignore */ }
    return false;
  }
}

/**
 * Move leads older than `days` (from their Timestamp column) into the Archive sheet.
 */
function archiveLeadsOlderThan(days) {
  days = typeof days === 'number' && days > 0 ? days : 30;
  var archivedCount = 0;
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheet = ss.getSheetByName('Leads');
    if (!sheet) return 0;

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    var now = new Date();
    var cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Ensure archive sheet exists and header
    var archiveSheetName = 'Archive';
    var archiveSheet = ss.getSheetByName(archiveSheetName) || ss.insertSheet(archiveSheetName);
    var header = data[0] || [];
    var ARCHIVE_COL_NAME = 'ArchivedAt';
    var archiveHeader = archiveSheet.getLastRow() >= 1 ? archiveSheet.getRange(1, 1, 1, Math.max(archiveSheet.getLastColumn(), header.length)).getValues()[0] : [];
    if (!archiveHeader || archiveHeader.length === 0) {
      var newHeader = header.slice(); newHeader.push(ARCHIVE_COL_NAME);
      archiveSheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
    } else if (archiveHeader.indexOf(ARCHIVE_COL_NAME) === -1) {
      archiveSheet.getRange(1, archiveHeader.length + 1).setValue(ARCHIVE_COL_NAME);
    }

    // Iterate from bottom up to safely delete rows
    for (var r = data.length - 1; r >= 1; r--) {
      try {
        var timestampCell = data[r][7]; // column 8 Timestamp
        var ts = timestampCell ? new Date(timestampCell) : null;
        if (!ts || isNaN(ts.getTime())) continue;
        if (ts < cutoff) {
          var row = data[r].slice();
          row.push(new Date());
          archiveSheet.appendRow(row);
          sheet.deleteRow(r + 1);
          archivedCount++;
        }
      } catch (rowErr) { /* ignore row errors and continue */ }
    }
  } catch (e) {
    console.log('archiveLeadsOlderThan: exception: ' + e);
  }
  console.log('archiveLeadsOlderThan: archived ' + archivedCount + ' rows older than ' + days + ' days');
  return archivedCount;
}

/**
 * Purge archived rows that have been archived longer than `days` days.
 */
function purgeArchivedOlderThan(days) {
  days = typeof days === 'number' && days > 0 ? days : 30;
  var purged = 0;
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var archiveSheet = ss.getSheetByName('Archive');
    if (!archiveSheet) return 0;

    var data = archiveSheet.getDataRange().getValues();
    if (data.length <= 1) return 0;

    var header = data[0] || [];
    var archIdx = header.indexOf('ArchivedAt');
    if (archIdx === -1) archIdx = header.length - 1; // fallback: assume last column

    var now = new Date();
    var cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    for (var r = data.length - 1; r >= 1; r--) {
      try {
        var archivedCell = data[r][archIdx];
        var at = archivedCell ? new Date(archivedCell) : null;
        if (!at || isNaN(at.getTime())) continue;
        if (at < cutoff) {
          archiveSheet.deleteRow(r + 1);
          purged++;
        }
      } catch (rowErr) { /* ignore */ }
    }
  } catch (e) {
    console.log('purgeArchivedOlderThan: exception: ' + e);
  }
  console.log('purgeArchivedOlderThan: purged ' + purged + ' rows older than ' + days + ' days');
  return purged;
}

/**
 * Scheduled helper: archive leads older than 30 days
 */
function scheduledArchiveLeadsOlderThan30() { return archiveLeadsOlderThan(30); }

/**
 * Scheduled helper: purge archived leads older than 30 days
 */
function scheduledPurgeArchivedOlderThan30() { return purgeArchivedOlderThan(30); }

/**
 * Helper: return spreadsheet info and list of sheets so you can confirm where Archive would be created.
 */
function getArchiveInfo() {
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var sheets = ss.getSheets().map(function(s){ return s.getName(); });
    var info = { url: ss.getUrl(), id: ss.getId(), sheets: sheets };
    console.log('getArchiveInfo:', JSON.stringify(info));
    return info;
  } catch (e) {
    console.log('getArchiveInfo: error: ' + e);
    return { error: e.toString() };
  }
}

/**
 * Helper: ensure Archive sheet exists (creates if missing) and returns { created: bool, name: string }
 */
function createArchiveIfMissing() {
  try {
    var ss = SpreadsheetApp.openById(LEAD_TRACKER_SHEET_ID);
    var name = 'Archive';
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      console.log('createArchiveIfMissing: Archive sheet already exists');
      return { created: false, name: name };
    }
    ss.insertSheet(name);
    console.log('createArchiveIfMissing: Archive sheet created');
    return { created: true, name: name };
  } catch (e) {
    console.log('createArchiveIfMissing: error: ' + e);
    return { error: e.toString() };
  }
}
