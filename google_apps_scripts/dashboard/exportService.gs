/**
 * Export Service Module
 * Handles data export functionality
 */

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
