/**
 * Data Service Module
 * Handles data retrieval and processing for the dashboard
 */

/**
 * Retrieves all leads from the Google Sheet with enhanced data processing
 */
function getLeads() {
  try {
    const LEAD_SHEET_ID = PropertiesService.getScriptProperties().getProperty('LEAD_TRACKER_SHEET_ID');
    const sheet = SpreadsheetApp.openById(LEAD_SHEET_ID).getSheetByName('Leads');
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return []; // No data (only header row)
    }

    const leads = [];
    const headers = data[0];

    // find dynamic column indices by header name where possible
    const idxOf = (name, fallback) => {
      const idx = headers.indexOf(name);
      return idx !== -1 ? idx : (typeof fallback === 'number' ? fallback : -1);
    };
    const CAL_SCHED_IDX = idxOf('CalendarScheduledAt', 17);
    const CAL_EVENT_ID_IDX = idxOf('CalendarEventId', 18);
    const RESPONSE_RECEIVED_IDX = idxOf('ResponseReceived', 13);
    const REMINDER_SENT_IDX = idxOf('ReminderSentAt', 9);

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // normalize calendar scheduled value to ISO timestamp with time when present
      let calendarScheduledAt = null;
      try {
        const rawCal = (CAL_SCHED_IDX !== -1) ? row[CAL_SCHED_IDX] : (row[17] || null);
        if (rawCal) {
          const dt = new Date(rawCal);
          if (!isNaN(dt.getTime())) calendarScheduledAt = dt.toISOString();
        }
      } catch (e) {
        calendarScheduledAt = null;
      }

      const lead = {
        email: row[0] || '',
        name: row[1] || '',
        phone: row[2] || '',
        preferredDay: row[3] || '',
        preferredTime: row[4] || '',
        appointmentTypes: row[5] || '',
        message: row[6] || '',
        timestamp: row[7] ? new Date(row[7]).toISOString() : new Date().toISOString(),
        reminderSentAt: (REMINDER_SENT_IDX !== -1 && row[REMINDER_SENT_IDX]) ? new Date(row[REMINDER_SENT_IDX]).toISOString() : null,
        threadId: row[10] || '',
        eventId: (CAL_EVENT_ID_IDX !== -1 && row[CAL_EVENT_ID_IDX]) ? row[CAL_EVENT_ID_IDX] : (row[11] || ''),
        matchMethod: row[12] || '',
        responseReceived: Boolean((RESPONSE_RECEIVED_IDX !== -1) ? row[RESPONSE_RECEIVED_IDX] : row[13]),
        executiveSummary: row[14] || '',
        questionnaireResponses: row[15] || '',
        questionnaireParsed: row[16] || '',
        calendarScheduledAt: calendarScheduledAt,
        calendarEventId: (CAL_EVENT_ID_IDX !== -1) ? (row[CAL_EVENT_ID_IDX] || '') : (row[18] || ''),
        // Enhanced status tracking for partial completion
        responseReceived: Boolean((RESPONSE_RECEIVED_IDX !== -1) ? row[RESPONSE_RECEIVED_IDX] : row[13]),
        calendarScheduled: Boolean(calendarScheduledAt),
        // Only mark as fully followed up if BOTH questionnaire response AND appointment are complete
        followedUp: Boolean((RESPONSE_RECEIVED_IDX !== -1) ? row[RESPONSE_RECEIVED_IDX] : row[13]) && Boolean(calendarScheduledAt),
        // Partial completion status
        completionStatus: getCompletionStatus(
          Boolean((RESPONSE_RECEIVED_IDX !== -1) ? row[RESPONSE_RECEIVED_IDX] : row[13]),
          Boolean(calendarScheduledAt)
        )
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

    // Partial completion metrics
    const questionnaireOnly = leads.filter(l => l.responseReceived && !l.calendarScheduled).length;
    const scheduledOnly = leads.filter(l => !l.responseReceived && l.calendarScheduled).length;
    const fullyComplete = leads.filter(l => l.responseReceived && l.calendarScheduled).length;
    const notStarted = leads.filter(l => !l.responseReceived && !l.calendarScheduled).length;

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
      // Partial completion breakdown
      questionnaireOnly,
      scheduledOnly,
      fullyComplete,
      notStarted,
      weeklyChange: Math.round(weeklyChange),
      responseRate: Math.round(responseRate),
      conversionRate: totalLeads > 0 ? Math.round((responsesReceived / totalLeads) * 100) : 0,
      completionRate: totalLeads > 0 ? Math.round((fullyComplete / totalLeads) * 100) : 0,
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
 * Gets system configuration and status
 */
function getSystemInfo() {
  try {
    const leads = getLeads();
    const LEAD_SHEET_ID = PropertiesService.getScriptProperties().getProperty('LEAD_TRACKER_SHEET_ID');
    const sheet = SpreadsheetApp.openById(LEAD_SHEET_ID);
    const lastModified = DriveApp.getFileById(LEAD_SHEET_ID).getLastUpdated();

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
