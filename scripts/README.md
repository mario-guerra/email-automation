# Lead Management Dashboard

A professional Streamlit-based dashboard for managing legal leads captured by the lead automation system.

## Features

### 🏠 Dashboard Home
- **Key Metrics**: Total leads, new leads this week, awaiting response, responses received
- **Recent Leads Table**: Quick overview of latest leads with action buttons
- **Visual Analytics**: 
  - Lead status distribution (pie chart)
  - Lead volume over time (line chart)
  - Legal service types distribution

### 👥 Lead Management
- **Advanced Filtering**: Search by name/email, filter by status and service type
- **Bulk Actions**: Mark multiple leads as followed up, export to CSV
- **Sortable Table**: View all leads with key information
- **Quick Actions**: Direct access to lead details

### 👤 Lead Details
- **Complete Lead Information**: Contact details, appointment preferences, status
- **Tabbed Interface**: 
  - Messages: Original inquiry and follow-up status
  - AI Summary: Automated executive summary of lead responses
  - Timeline: Communication history and events
- **Action Buttons**: Mark as followed up, send email, schedule consultation

### 📊 Analytics
- **Performance Metrics**: Response rates, conversion rates, leads per day
- **Time-based Analysis**: Configurable date ranges
- **Visual Reports**:
  - Lead volume trends
  - Status funnel analysis
  - Service type breakdowns
- **Performance Summary Table**: Key statistics and insights

## Design Features

### Professional Styling
- **Color Scheme**: Professional blue theme (#1E88E5)
- **Status Indicators**: Color-coded status badges
  - New: Amber (#FFC107)
  - Awaiting Response: Light Blue (#03A9F4)
  - Responded: Green (#4CAF50)
  - Scheduled: Purple (#9C27B0)

### User Experience
- **Responsive Design**: Works on desktop and mobile
- **Intuitive Navigation**: Sidebar navigation with clear icons
- **Quick Actions**: Minimal clicks for common tasks
- **Real-time Updates**: Automatic data refresh with caching

## Setup Instructions

### Prerequisites
- Python 3.7+
- Google Sheets API access
- Streamlit account (optional, for deployment)

### Installation

1. **Clone and Navigate**:
   ```bash
   cd /path/to/email-automation/scripts
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Google Sheets API**:
   - Create a Google Cloud Project
   - Enable Google Sheets API and Google Drive API
   - Create a Service Account
   - Download the service account JSON key
   - Share your Google Sheet with the service account email

4. **Setup Secrets** (`.streamlit/secrets.toml`):
   ```toml
   [google]
   lead_tracker_sheet_id = "your_google_sheet_id"
   
   [google.service_account]
   type = "service_account"
   project_id = "your-project-id"
   private_key_id = "your-private-key-id"
   private_key = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   client_email = "your-service-account@your-project.iam.gserviceaccount.com"
   client_id = "your-client-id"
   auth_uri = "https://accounts.google.com/o/oauth2/auth"
   token_uri = "https://oauth2.googleapis.com/token"
   auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
   client_x509_cert_url = "https://www.googleapis.com/robot/v1/metadata/x509/..."
   
   [auth]
   username = "admin"
   password = "your_secure_password"
   
   [apps_script]
   calendly_link = "https://calendly.com/your-link"
   your_email = "your.email@domain.com"
   ```

### Running the Dashboard

1. **Local Development**:
   ```bash
   streamlit run dashboard.py
   ```

2. **Access**: Open http://localhost:8501 in your browser

3. **Login**: Use the credentials from your secrets.toml file

## Data Structure

The dashboard expects the following columns in your Google Sheet:

| Column | Description | Type |
|--------|-------------|------|
| Email | Lead's email address | String |
| Name | Lead's name | String |
| Phone | Lead's phone number | String |
| Preferred Day | Preferred consultation day | String |
| Preferred Time | Preferred consultation time | String |
| Appointment Types | Legal services requested | String |
| Message | Original message from lead | String |
| Timestamp | When lead was received | DateTime |
| Followed Up | Whether follow-up was sent | Boolean |
| ReminderSentAt | When reminder was sent | DateTime |
| ThreadId | Gmail thread ID | String |
| EventId | Calendar event ID | String |
| MatchMethod | Follow-up detection method | String |
| ResponseReceived | Whether lead responded | Boolean |
| ExecutiveSummary | AI-generated summary | String |

## Customization

### Styling
- Modify the CSS in the `st.markdown()` sections
- Adjust colors in the status indicators
- Update the color scheme constants

### Features
- Add new pages by extending the navigation system
- Implement additional charts using Plotly
- Extend the filtering capabilities

### Integration
- Connect to additional data sources
- Implement email sending functionality
- Add calendar integration for scheduling

## Deployment

### Streamlit Cloud
1. Push your code to GitHub (excluding secrets.toml)
2. Connect your GitHub repo to Streamlit Cloud
3. Add your secrets in the Streamlit Cloud dashboard
4. Deploy and share the public URL

### Local Server
```bash
streamlit run dashboard.py --server.port 8501 --server.address 0.0.0.0
```

## Troubleshooting

### Common Issues

1. **Google Sheets Connection Error**:
   - Verify service account credentials
   - Ensure the sheet is shared with the service account email
   - Check that the sheet ID is correct

2. **Authentication Issues**:
   - Verify username/password in secrets.toml
   - Clear browser cache and cookies

3. **Data Not Loading**:
   - Check Google Sheets API quotas
   - Verify column names match expected structure
   - Review Streamlit logs for error messages

### Performance Optimization

- **Caching**: Data is cached for 5 minutes to improve performance
- **Pagination**: Large datasets are paginated automatically
- **Lazy Loading**: Charts are only generated when needed

## Security Considerations

- **Never commit secrets.toml** to version control
- Use strong passwords for dashboard authentication
- Regularly rotate service account keys
- Implement proper session management for production use

## Support

For issues or questions:
1. Check the Streamlit logs for error messages
2. Verify your Google Sheets setup
3. Review the data structure requirements
4. Contact your system administrator

## License

This dashboard is part of the lead automation system and follows the same licensing terms.
