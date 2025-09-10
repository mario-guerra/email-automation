# Lead Management Dashboard Design (MVP)

## Overview

This document outlines the design for a minimalist yet effective lead management dashboard for lawyers. The dashboard is designed to work with the existing lead automation system, providing a streamlined interface for lawyers to manage and follow up with potential clients.

## Data Structure Available

Based on the `lead_automation.js` script, we have access to the following data points in the Google Sheet:

| Column | Description |
|--------|-------------|
| Email | Lead's email address |
| Name | Lead's name |
| Phone | Lead's phone number |
| Preferred Day | Preferred day for consultation |
| Preferred Time | Preferred time for consultation |
| Appointment Types | Type(s) of legal services requested (Probate, Small Business, Estate Planning, Traffic/Criminal) |
| Message | Original message from the lead |
| Timestamp | When the lead was received |
| Followed Up | Whether the lead has been followed up with (automated or manual) |
| ReminderSentAt | When an automated reminder was sent |
| ThreadId | Gmail thread ID for tracking communication |
| EventId | Calendar event ID if scheduled |
| MatchMethod | How follow-up was detected (calendar-api, threadid, gmail-search, ics-attachment) |
| ResponseReceived | Whether the lead has responded to our outreach |
| ExecutiveSummary | AI-generated summary of the lead's response (if enabled) |

## Dashboard Pages & Features

### 1. Dashboard Home

**Purpose**: Quick overview of lead status and recent activity.

**Key Components**:

- **Metrics Cards**:
  - Total Leads
  - New Leads This Week
  - Awaiting Response (not followed up)
  - Responses Received

- **Recent Leads Table**:
  - Columns: Name, Email, Appointment Types, Date, Status
  - Quick action buttons (View Details, Mark as Followed Up)
  - Color-coding for status (New, Awaiting Response, Response Received)

- **Visualizations**:
  - Lead Volume Chart: Line chart showing lead volume over time
  - Appointment Types Chart: Distribution of legal matters

### 2. Lead Management Page

**Purpose**: Comprehensive view and management of all leads.

**Key Components**:

- **Search & Filter Bar**:
  - Search by name or email
  - Filter by status (All, Awaiting Response, Response Received, Followed Up)
  - Filter by appointment type
  - Date range filter

- **Leads Table**:
  - Sortable columns: Name, Email, Phone, Appointment Types, Date, Status
  - Status indicators with colors
  - Action buttons for each lead

- **Bulk Actions**:
  - Mark selected leads as followed up
  - Export selected leads to CSV

### 3. Lead Detail View

**Purpose**: In-depth view of a specific lead with all available information and actions.

**Key Components**:

- **Contact Information Card**:
  - Name, Email, Phone
  - Preferred consultation day/time
  - Date received

- **Appointment Information**:
  - Types of legal services requested
  - Status (Awaiting Response, Response Received, Scheduled)
  - Follow-up information (when, method)

- **Communication Timeline**:
  - Original message
  - Automated emails sent (welcome email, reminder)
  - Response (if received)
  - Executive Summary (if AI is enabled)

- **Questionnaires Section**:
  - Relevant questionnaires based on appointment types
  - Option to email questionnaires again

- **Actions Panel**:
  - Mark as Followed Up button
  - Send Email button
  - Schedule Consultation button (Calendly link)

### 4. Analytics Page

**Purpose**: Simple data insights on lead acquisition and conversion.

**Key Components**:

- **Date Range Selector**:
  - Predefined ranges (This Week, Last Week, This Month, Last 30 Days, etc.)

- **Performance Metrics**:
  - Lead volume
  - Response rate
  - Follow-up effectiveness (% of leads responding after follow-up)

- **Visualizations**:
  - Lead Status Funnel: Received → Followed Up → Response Received → Scheduled
  - Appointment Types: Distribution by legal service type
  - Time Distribution: Days of week / times when leads come in

## UI/UX Considerations

### User Flow

1. **Login** → Dashboard Home (overview)
2. **Find Lead** → Filter/Search → Lead Detail View
3. **Process Lead** → View Information → Take Action (Follow Up/Mark as Contacted)

### Design Principles

1. **Efficiency First**: Minimize clicks for common tasks
2. **Clear Status Indicators**: Visual cues for lead status (colors, icons)
3. **Focused Interface**: Only show relevant information at each stage
4. **Mobile-Friendly**: Responsive design for checking leads on the go

### Color Scheme

- **Primary**: Professional blue (#1E88E5)
- **Status Colors**:
  - New/Unprocessed: Amber (#FFC107)
  - Awaiting Response: Light Blue (#03A9F4)
  - Response Received: Green (#4CAF50)
  - Scheduled: Purple (#9C27B0)

## Technical Implementation

### Front-End

- **Framework**: Streamlit (Python)
- **Authentication**: Simple username/password for MVP
- **Data Visualization**: Native Streamlit charts or Plotly
- **Storage**: Google Sheets (existing)

### Key Functions Needed

1. **Authentication System**:
   - Simple login with credentials stored in secrets
   - Session management

2. **Data Retrieval**:
   - Connect to Google Sheets API
   - Cache lead data for performance
   - Real-time updates

3. **Lead Management**:
   - Filter/sort functionality
   - Update lead status
   - Send/schedule emails

4. **Questionnaire Access**:
   - Fetch questionnaire content from Google Drive
   - Display formatted questionnaires

## MVP Roadmap

### Phase 1: Basic Dashboard
- Authentication system
- Dashboard homepage with metrics
- Basic lead table with filtering

### Phase 2: Lead Management
- Detailed lead view
- Follow-up functionality
- Questionnaire access

### Phase 3: Analytics
- Basic charts and visualizations
- Performance metrics
- Export functionality

## Future Enhancements (Post-MVP)

1. **Email Integration**:
   - Send emails directly from the dashboard
   - View full email threads

2. **Calendar Integration**:
   - Embedded scheduling widget
   - View upcoming consultations

3. **Document Management**:
   - Upload/store client documents
   - Document templates

4. **Advanced Analytics**:
   - Conversion tracking
   - ROI calculation by lead source
   - Predictive lead scoring

5. **Client Portal**:
   - Secure area for clients to upload documents
   - View appointment history and details

## Conclusion

This MVP dashboard design focuses on the core functionality needed by lawyers to efficiently manage their leads. By leveraging the existing data structure and automation system, we can provide immediate value while setting a foundation for future enhancements.

The design prioritizes simplicity, efficiency, and practical utility over complex features, ensuring that lawyers can quickly adopt the system and integrate it into their workflow with minimal training.
