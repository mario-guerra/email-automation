function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Lead Management Dashboard - Guerra Law Firm')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/gsheets_24dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Retrieves all leads from the Google Sheet with enhanced data processing
 */
function getLeads() {
  try {
    const sheet = SpreadsheetApp.openById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg').getSheetByName('Leads');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return []; // No data (only header row)
    }
    
    const leads = [];
    const headers = data[0];
    
    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const lead = {
        email: row[0] || '',
        name: row[1] || '',
        phone: row[2] || '',
        preferredDay: row[3] || '',
        preferredTime: row[4] || '',
        appointmentTypes: row[5] || '',
        message: row[6] || '',
        timestamp: row[7] ? new Date(row[7]).toISOString() : new Date().toISOString(),
        followedUp: Boolean(row[8]),
        reminderSentAt: row[9] ? new Date(row[9]).toISOString() : null,
        threadId: row[10] || '',
        eventId: row[11] || '',
        matchMethod: row[12] || '',
        responseReceived: Boolean(row[13]),
        executiveSummary: row[14] || '',
        questionnaireResponses: row[15] || '',
        questionnaireParsed: row[16] || ''
      };
      
      leads.push(lead);
    }
    
    // Sort by timestamp (newest first)
    leads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return leads;
  } catch (error) {
    console.error('Error retrieving leads:', error);
    throw new Error('Failed to retrieve leads: ' + error.message);
  }
}

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

/**
 * Calculates dashboard metrics
 */
function getMetrics() {
  try {
    const leads = getLeads();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Current period metrics
    const totalLeads = leads.length;
    const newThisWeek = leads.filter(l => new Date(l.timestamp) >= weekAgo).length;
    const awaitingResponse = leads.filter(l => !l.followedUp && !l.responseReceived).length;
    const responsesReceived = leads.filter(l => l.responseReceived).length;
    const followedUp = leads.filter(l => l.followedUp).length;
    
    // Previous period for comparison
    const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekLeads = leads.filter(l => {
      const date = new Date(l.timestamp);
      return date >= prevWeekStart && date < weekAgo;
    }).length;
    
    const prevMonthStart = new Date(monthAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevMonthLeads = leads.filter(l => {
      const date = new Date(l.timestamp);
      return date >= prevMonthStart && date < monthAgo;
    }).length;
    
    // Calculate percentage changes
    const weeklyChange = prevWeekLeads > 0 ? ((newThisWeek - prevWeekLeads) / prevWeekLeads * 100) : 0;
    const responseRate = followedUp > 0 ? (responsesReceived / followedUp * 100) : 0;
    
    // Service type breakdown
    const serviceTypes = {};
    leads.forEach(lead => {
      if (lead.appointmentTypes) {
        const types = lead.appointmentTypes.split(',').map(t => t.trim());
        types.forEach(type => {
          serviceTypes[type] = (serviceTypes[type] || 0) + 1;
        });
      }
    });
    
    return {
      totalLeads,
      newThisWeek,
      awaitingResponse,
      responsesReceived,
      followedUp,
      weeklyChange: Math.round(weeklyChange),
      responseRate: Math.round(responseRate),
      conversionRate: totalLeads > 0 ? Math.round((responsesReceived / totalLeads) * 100) : 0,
      serviceTypes,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating metrics:', error);
    throw new Error('Failed to calculate metrics: ' + error.message);
  }
}

/**
 * Gets analytics data for specified date range
 */
function getAnalyticsData(dateRange = 'last30') {
  try {
    const leads = getLeads();
    const now = new Date();
    let startDate;
    
    switch(dateRange) {
      case 'last7':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        return filterLeadsByDateRange(leads, startDate, endDate);
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return filterLeadsByDateRange(leads, startDate, now);
  } catch (error) {
    console.error('Error getting analytics data:', error);
    throw new Error('Failed to get analytics data: ' + error.message);
  }
}

/**
 * Helper function to filter leads by date range
 */
function filterLeadsByDateRange(leads, startDate, endDate) {
  return leads.filter(lead => {
    const leadDate = new Date(lead.timestamp);
    return leadDate >= startDate && leadDate <= endDate;
  });
}

/**
 * Sends an email notification (placeholder for future implementation)
 */
function sendEmailNotification(to, subject, body) {
  try {
    // This would integrate with the existing email automation
    // For now, this is a placeholder
    console.log(`Email notification: ${to} - ${subject}`);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

/**
 * Gets system configuration and status
 */
function getSystemInfo() {
  try {
    const leads = getLeads();
    const sheet = SpreadsheetApp.openById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg');
    const lastModified = DriveApp.getFileById('1tqjF1eUxzF3Hk6iCcJxv2fA4h-BFHf20rtgWHBADdkg').getLastUpdated();
    
    return {
      version: '1.2.0',
      totalRecords: leads.length,
      lastUpdated: lastModified.toISOString(),
      sheetUrl: sheet.getUrl(),
      backupStatus: 'Active',
      aiEnabled: true
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    throw new Error('Failed to get system info: ' + error.message);
  }
}

/**
 * Exports lead data as CSV (returns CSV string)
 */
function exportLeadsAsCSV(filterCriteria = null) {
  try {
    let leads = getLeads();
    
    // Apply filters if provided
    if (filterCriteria) {
      leads = applyFiltersToLeads(leads, filterCriteria);
    }
    
    // CSV headers
    const headers = [
      'Name', 'Email', 'Phone', 'Appointment Types', 'Timestamp', 
      'Status', 'Message', 'Executive Summary', 'Followed Up', 'Response Received'
    ];
    
    // Convert leads to CSV format
    const csvRows = [headers.join(',')];
    
    leads.forEach(lead => {
      const status = determineLeadStatus(lead);
      const row = [
        escapeCSV(lead.name),
        escapeCSV(lead.email),
        escapeCSV(lead.phone),
        escapeCSV(lead.appointmentTypes),
        escapeCSV(new Date(lead.timestamp).toLocaleString()),
        escapeCSV(status),
        escapeCSV(lead.message),
        escapeCSV(lead.executiveSummary),
        lead.followedUp ? 'Yes' : 'No',
        lead.responseReceived ? 'Yes' : 'No'
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export CSV: ' + error.message);
  }
}

/**
 * Helper function to determine lead status
 */
function determineLeadStatus(lead) {
  if (!lead.followedUp) return 'New';
  if (lead.responseReceived) {
    if (lead.eventId || (lead.executiveSummary && lead.executiveSummary.toLowerCase().includes('scheduled'))) {
      return 'Scheduled';
    }
    return 'Responded';
  }
  return 'Awaiting Response';
}

/**
 * Helper function to escape CSV values
 */
function escapeCSV(value) {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

/**
 * Helper function to apply filters to leads array
 */
function applyFiltersToLeads(leads, filters) {
  return leads.filter(lead => {
    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch = 
        (lead.name && lead.name.toLowerCase().includes(searchTerm)) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm));
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (filters.status && filters.status !== 'all') {
      const status = determineLeadStatus(lead);
      if (status.toLowerCase().replace(' ', '-') !== filters.status) return false;
    }
    
    // Type filter
    if (filters.type && filters.type !== 'all') {
      if (!lead.appointmentTypes || !lead.appointmentTypes.includes(filters.type)) return false;
    }
    
    // Date filter
    if (filters.date) {
      const leadDate = new Date(lead.timestamp).toISOString().split('T')[0];
      if (leadDate !== filters.date) return false;
    }
    
    return true;
  });
}

/**
 * Test function to verify the setup
 */
function testSetup() {
  try {
    const leads = getLeads();
    const metrics = getMetrics();
    const systemInfo = getSystemInfo();
    
    return {
      success: true,
      message: 'Dashboard setup test completed successfully',
      data: {
        leadsCount: leads.length,
        metricsKeys: Object.keys(metrics),
        systemVersion: systemInfo.version
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Dashboard setup test failed: ' + error.message,
      error: error.toString()
    };
  }
}