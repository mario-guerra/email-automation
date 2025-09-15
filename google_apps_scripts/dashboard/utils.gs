/**
 * Dashboard Utilities Module
 * Shared utility functions for the dashboard
 */

/**
 * Helper function to determine lead status
 */
function determineLeadStatus(lead) {
  // Use the detailed completion status for more accurate reporting
  if (lead.completionStatus === 'Fully Complete') {
    return 'Complete';
  } else if (lead.completionStatus === 'Questionnaire Complete - Needs Scheduling') {
    return 'Needs Scheduling';
  } else if (lead.completionStatus === 'Appointment Scheduled - Needs Questionnaire') {
    return 'Needs Questionnaire';
  } else if (lead.completionStatus === 'Not Started') {
    return 'New Lead';
  }

  // Fallback to original logic if completionStatus is not available
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
 * Helper function to get detailed completion status
 */
function getCompletionStatus(hasResponded, hasScheduled) {
  if (hasResponded && hasScheduled) {
    return 'Fully Complete';
  } else if (hasResponded && !hasScheduled) {
    return 'Questionnaire Complete - Needs Scheduling';
  } else if (!hasResponded && hasScheduled) {
    return 'Appointment Scheduled - Needs Questionnaire';
  } else {
    return 'Not Started';
  }
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
