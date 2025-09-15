# Lead Management Dashboard - Google Apps Script

## 🚀 Enterprise-Grade Email Automation & Lead Management System

This comprehensive Google Apps Script project provides a professional, AI-powered lead management dashboard with automated email processing, intelligent follow-up systems, and advanced analytics for law firms. Built with a modular architecture for scalability and maintainability.

## ✨ Key Features

### 🤖 AI-Powered Email Processing
- **Intelligent Lead Parsing**: AI-driven extraction of client information from emails
- **Automated Questionnaire Handling**: Smart processing of intake forms and responses
- **Context-Aware Summarization**: AI-generated executive summaries of client inquiries
- **Multi-Format Support**: Handles various email formats and structures

### 📊 Professional Dashboard
- **Real-time Metrics**: Live KPI cards with conversion tracking and performance indicators
- **Interactive Analytics**: Comprehensive charts for lead volume, service distribution, and response analysis
- **Advanced Filtering**: Multi-criteria search and filtering with real-time updates
- **Bulk Operations**: Select and manage multiple leads simultaneously

### 📧 Automated Workflow Management
- **Smart Follow-up System**: Automated email sequences based on lead status and engagement
- **Calendar Integration**: Automatic appointment scheduling with Calendly integration
- **Response Tracking**: Intelligent detection of client responses and engagement
- **Archive Management**: Automated archiving of completed leads

### 🔧 Enterprise Testing Framework
- **Comprehensive Test Suite**: 25+ automated tests covering all system components
- **Configuration Validation**: Automated checking of all required settings
- **Performance Benchmarking**: Built-in performance testing and optimization
- **Debug Tools**: Advanced debugging utilities for troubleshooting

### 📈 Advanced Analytics & Reporting
- **Conversion Funnel Analysis**: Track leads from inquiry to appointment
- **Service Type Breakdown**: Analyze demand by practice area
- **Response Time Metrics**: Monitor team performance and efficiency
- **Custom Date Ranges**: Flexible reporting periods (7 days to 1 year)

## 🏗️ Modular Architecture

### Core Modules

#### 📧 Email Processing (`email-processing/`)
- `emailProcessor.gs` - Main email processing logic
- `aiParser.gs` - AI-powered content analysis and parsing
- `followUpManager.gs` - Automated follow-up sequence management
- `archiveManager.gs` - Lead archiving and cleanup

#### 📊 Dashboard (`dashboard/`)
- `webInterface.gs` - Web app entry point and routing
- `dataService.gs` - Data retrieval, processing, and metrics calculation
- `analyticsService.gs` - Advanced analytics and reporting functions

#### 🔧 Core System
- `quickTestRunner.gs` - Comprehensive testing framework
- `tests.gs` - QUnit-based testing infrastructure
- `config.gs` - Configuration management and validation
- `utils.gs` - Utility functions and helpers

### Frontend Components
- `Index.html` - Professional web interface with Bootstrap 5
- `dashboard.html` - Dashboard-specific templates
- `analytics.html` - Analytics visualization components

## 📋 Setup & Deployment

### Prerequisites
- Google Workspace account with Apps Script access
- Google Sheets for data storage
- Google Drive for file storage
- Node.js and clasp for development

### 1. Local Development Setup

```bash
# Clone the repository
git clone https://github.com/mario-guerra/email-automation.git
cd email-automation/google_apps_scripts

# Install clasp globally
npm install -g @google/clasp

# Login to Google
clasp login

# Create new Apps Script project
clasp create "Lead Management Dashboard"

# Push code to Apps Script
clasp push
```

### 2. Configuration Setup

Update the configuration in `config.gs` or via PropertiesService:

```javascript
// Required Configuration Values
PropertiesService.getScriptProperties().setProperties({
  'CALENDLY_LINK': 'https://calendly.com/your-link',
  'LEAD_TRACKER_SHEET_ID': 'your-google-sheet-id',
  'YOUR_EMAIL': 'your-email@gmail.com',
  'FOLDER_ID': 'your-drive-folder-id',
  'CALENDAR_ID': 'your-calendar-id', // Optional
  'OPENAI_API_KEY': 'your-openai-key' // Optional, for AI features
});
```

### 3. Google Sheets Setup

Create a Google Sheet with the following structure:

| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | Email | String | Lead's email address |
| B | Name | String | Lead's full name |
| C | Phone | String | Phone number |
| D | Preferred Day | String | Preferred consultation day |
| E | Preferred Time | String | Preferred consultation time |
| F | Appointment Types | String | Services requested (comma-separated) |
| G | Message | String | Original inquiry message |
| H | Timestamp | DateTime | When lead was received |
| I | Reminder Sent At | DateTime | When reminder was sent |
| J | Thread ID | String | Gmail thread ID |
| K | Event ID | String | Calendar event ID |
| L | Match Method | String | How response was detected |
| M | Response Received | Boolean | Whether client responded |
| N | Followed Up | Boolean | Whether follow-up was sent |
| O | Executive Summary | String | AI-generated summary |
| P | Questionnaire Responses | String | Raw questionnaire responses |
| Q | Questionnaire Parsed | String | Parsed questionnaire data |
| R | Calendar Scheduled At | DateTime | When appointment was scheduled |
| S | Calendar Event Id | String | Calendar event identifier |
| T | Completion Status | String | Lead completion status |

### 4. Permissions & Authorization

Grant the following permissions when prompted:
- **Gmail API**: Read/write access for email processing
- **Google Sheets API**: Full access to lead tracker spreadsheet
- **Google Drive API**: Read access to questionnaire folder
- **Google Calendar API**: Read/write access for appointment scheduling
- **Properties Service**: Access to script properties

### 5. Deployment

```bash
# Deploy to production
clasp deploy

# Or create new deployment
clasp deployments
```

## 🧪 Testing Framework

### Running Tests

```javascript
// Run comprehensive test suite
runComprehensiveTests();

// Run quick tests (subset)
runQuickTests();

// Debug configuration
debugConfiguration();

// Debug sheet contents
debugSheetContents();

// Debug metrics
debugMetricsCalculation();

// Run all debug functions
runComprehensiveDebug();
```

### Test Coverage

The testing framework includes 25+ automated tests:

#### 🔧 Configuration Tests
- Required configuration values validation
- Configuration format verification
- Questionnaire files access testing

#### 📊 Sheet Access Tests
- Basic spreadsheet connectivity
- Sheet structure validation
- CRUD operations testing

#### 📧 Email Processing Tests
- Basic email parsing validation
- Multiple email format support
- Email validation and sanitization

#### 📈 Dashboard Tests
- Metrics calculation accuracy
- Data retrieval functionality
- Web interface element validation

#### 🤖 AI Parser Tests
- Name extraction accuracy
- Content summarization quality
- AI service integration

#### 📋 Integration Tests
- End-to-end workflow validation
- Cross-module functionality
- Performance benchmarking

## 🎯 Key Improvements

### Technical Enhancements
- ✅ **Modular Architecture**: Clean separation of concerns with dedicated modules
- ✅ **Comprehensive Testing**: Enterprise-grade test coverage with debugging tools
- ✅ **Error Resilience**: Robust error handling and recovery mechanisms
- ✅ **Performance Optimization**: Efficient data processing and caching strategies
- ✅ **Configuration Management**: Centralized configuration with validation

### Feature Enhancements
- ✅ **AI-Powered Processing**: Intelligent email parsing and summarization
- ✅ **Automated Workflows**: Smart follow-up and archiving systems
- ✅ **Advanced Analytics**: Comprehensive reporting and insights
- ✅ **Bulk Operations**: Efficient management of multiple leads
- ✅ **Real-time Updates**: Live data synchronization and refresh

### User Experience
- ✅ **Professional UI**: Modern, responsive design with accessibility features
- ✅ **Intuitive Navigation**: Clear information hierarchy and workflow
- ✅ **Mobile Optimization**: Full responsive design for all devices
- ✅ **Performance Monitoring**: Real-time system health and performance metrics

## 📊 Usage Guide

### Daily Operations

1. **Monitor Dashboard**: Check real-time metrics and recent leads
2. **Process New Leads**: Review and categorize incoming inquiries
3. **Send Follow-ups**: Use automated follow-up system for engagement
4. **Schedule Appointments**: Integrate with Calendly for booking
5. **Track Progress**: Monitor conversion rates and team performance

### Weekly Maintenance

1. **Run Test Suite**: Execute comprehensive tests to ensure system health
2. **Review Analytics**: Analyze weekly performance and identify trends
3. **Clean Archives**: Archive completed leads and optimize storage
4. **Update Configuration**: Review and update system settings as needed

### Monthly Reporting

1. **Generate Reports**: Export comprehensive analytics and metrics
2. **Performance Review**: Analyze team performance and conversion rates
3. **System Optimization**: Review and optimize based on usage patterns
4. **Backup Verification**: Ensure all data is properly backed up

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Configuration Problems
```javascript
// Check configuration values
debugConfiguration();

// Verify sheet access
debugSheetContents();
```

#### Email Processing Issues
```javascript
// Test email parsing
testBasicEmailParsing();

// Check Gmail permissions
testGmailAccess();
```

#### Dashboard Problems
```javascript
// Test metrics calculation
debugMetricsCalculation();

// Check web interface
testWebInterface();
```

#### Performance Issues
```javascript
// Run performance tests
runPerformanceTests();

// Check system resources
getSystemInfo();
```

### Debug Commands

```javascript
// Comprehensive debugging
runComprehensiveDebug();

// Individual component tests
runConfigurationTests();
runSheetAccessTests();
runEmailProcessingTests();
runDashboardTests();
```

## 📈 Performance Optimization

### System Performance
- **Efficient Queries**: Optimized Google Sheets API calls
- **Smart Caching**: Intelligent data caching and refresh strategies
- **Batch Operations**: Bulk processing for improved performance
- **Lazy Loading**: On-demand data loading for better responsiveness

### Monitoring & Maintenance
- **Automated Testing**: Regular test execution for system validation
- **Performance Benchmarking**: Built-in performance monitoring tools
- **Error Tracking**: Comprehensive error logging and reporting
- **Resource Optimization**: Automatic cleanup and optimization routines

## 🔒 Security & Compliance

### Data Security
- **Google Security**: All data secured by Google's enterprise-grade infrastructure
- **Access Control**: Granular permission management
- **Audit Logging**: Comprehensive activity tracking
- **Encryption**: Data encrypted in transit and at rest

### Compliance Features
- **Data Retention**: Configurable data retention policies
- **Privacy Controls**: GDPR and privacy regulation compliance
- **Access Logging**: Detailed audit trails for all operations
- **Secure Configuration**: Protected configuration storage

## 🚀 Advanced Features

### AI Integration
- **Intelligent Parsing**: AI-powered extraction of client information
- **Smart Summarization**: Automatic generation of executive summaries
- **Context Awareness**: Understanding of legal context and terminology
- **Quality Assurance**: Automated validation of AI-generated content

### Workflow Automation
- **Conditional Logic**: Smart decision-making based on lead characteristics
- **Template System**: Dynamic email templates based on lead type
- **Integration APIs**: Seamless integration with external services
- **Custom Triggers**: Configurable automation triggers and actions

### Analytics & Insights
- **Predictive Analytics**: Forecasting based on historical data
- **Custom Metrics**: Configurable KPI tracking and reporting
- **Trend Analysis**: Long-term pattern recognition and insights
- **Performance Benchmarking**: Comparative analysis and optimization

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- **Weekly Testing**: Run comprehensive test suite
- **Monthly Analytics Review**: Analyze system performance and usage
- **Quarterly Optimization**: Review and optimize based on usage patterns
- **Annual Security Review**: Update security settings and permissions

### Getting Help
- **Built-in Diagnostics**: Use comprehensive debugging tools
- **Test Framework**: Automated testing for issue identification
- **Documentation**: Detailed troubleshooting guides
- **Community Resources**: Access to Google Apps Script community

## 🔄 Version History

### v2.0.0 (Current)
- Complete modular architecture overhaul
- AI-powered email processing and parsing
- Comprehensive testing framework (25+ tests)
- Advanced analytics and reporting
- Automated workflow management
- Professional web interface redesign

### v1.2.0
- Enhanced dashboard with modern UI
- Basic analytics and metrics
- Improved mobile responsiveness
- Advanced filtering capabilities

### v1.1.0
- Basic dashboard functionality
- Simple lead management
- Basic email processing

### v1.0.0
- Initial implementation
- Basic lead tracking
- Simple web interface

## 📄 License & Attribution

This project is designed for professional legal practice management. Built with modern web technologies and Google Workspace integration for optimal performance and reliability.

---

## 🎯 Enterprise-Grade Solution

This system represents a complete transformation from basic lead tracking to an enterprise-grade, AI-powered lead management and email automation platform. With comprehensive testing, modular architecture, and advanced analytics, it provides the reliability and scalability needed for professional legal practice operations.

**Key Differentiators:**
- 🤖 AI-powered intelligent processing
- 🧪 Enterprise testing framework
- 📊 Advanced analytics and insights
- 🔄 Automated workflow management
- 📱 Professional, responsive interface
- 🏗️ Modular, maintainable architecture
- 🔒 Enterprise-grade security and compliance
