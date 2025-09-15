/**
 * CRUD Operations Module
 * Handles Create, Read, Update, Delete operations for leads
 */

/**
 * Deletes a lead by email address
 */
function deleteLead(email) {
  try {
    const sheet = SpreadsheetApp.openById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg').getSheetByName('Leads');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === email) {
        sheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
        return true;
      }
    }

    return false; // Lead not found
  } catch (error) {
    console.error('Error deleting lead:', error);
    throw new Error('Failed to delete lead: ' + error.message);
  }
}

/**
 * Updates the follow-up status for a lead
 */
function updateLeadFollowUpStatus(email, followedUp = true) {
  try {
    const sheet = SpreadsheetApp.openById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg').getSheetByName('Leads');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === email) {
        sheet.getRange(i + 1, 9).setValue(followedUp); // Column I (Followed Up)
        if (followedUp) {
          sheet.getRange(i + 1, 10).setValue(new Date()); // Column J (ReminderSentAt)
        }
        return true;
      }
    }

    return false; // Lead not found
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw new Error('Failed to update lead status: ' + error.message);
  }
}

/**
 * Bulk update follow-up status for multiple leads
 */
function bulkUpdateFollowUpStatus(emails) {
  try {
    const sheet = SpreadsheetApp.openById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg').getSheetByName('Leads');
    const data = sheet.getDataRange().getValues();
    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      if (emails.includes(data[i][0])) {
        sheet.getRange(i + 1, 9).setValue(true); // Column I (Followed Up)
        sheet.getRange(i + 1, 10).setValue(new Date()); // Column J (ReminderSentAt)
        updatedCount++;
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error bulk updating leads:', error);
    throw new Error('Failed to bulk update leads: ' + error.message);
  }
}

/**
 * Retrieves questionnaire content from Google Drive
 */
function getQuestionnaire(fileName) {
  try {
    const folder = DriveApp.getFolderById('1GGrFx626jIuBgCe4dy94y7EkfKx05QUC');
    const files = folder.getFilesByName(fileName);

    if (files.hasNext()) {
      const file = files.next();
      return file.getBlob().getDataAsString();
    }

    return 'Questionnaire not found: ' + fileName;
  } catch (error) {
    console.error('Error retrieving questionnaire:', error);
    return 'Error retrieving questionnaire: ' + error.message;
  }
}
