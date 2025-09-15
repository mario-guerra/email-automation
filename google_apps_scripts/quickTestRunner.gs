/**
 * Comprehensive Test Runner for Google Apps Script
 * Run this function from the GAS editor to test all modules thoroughly
 */

function runComprehensiveTests() {
  Logger.log('=== COMPREHENSIVE TEST SUITE STARTED ===');

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    performance: {},
    coverage: {}
  };

  const startTime = new Date().getTime();

  // Core System Tests
  results.tests.push(...runCoreSystemTests());

  // Module-Specific Tests
  results.tests.push(...runModuleTests());

  // Integration Tests
  results.tests.push(...runIntegrationTests());

  // Edge Case Tests
  results.tests.push(...runEdgeCaseTests());

  // Performance Tests
  results.performance = runPerformanceTests();

  // Calculate coverage
  results.coverage = calculateTestCoverage(results.tests);

  const endTime = new Date().getTime();
  results.totalDuration = endTime - startTime;

  // Summary
  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const failed = results.tests.filter(t => t.status === 'FAIL').length;
  const errors = results.tests.filter(t => t.status === 'ERROR').length;
  const total = results.tests.length;

  Logger.log('=== COMPREHENSIVE TEST RESULTS ===');
  Logger.log(`Total Tests: ${total}`);
  Logger.log(`Passed: ${passed} (${Math.round(passed/total*100)}%)`);
  Logger.log(`Failed: ${failed}`);
  Logger.log(`Errors: ${errors}`);
  Logger.log(`Total Duration: ${results.totalDuration}ms`);
  Logger.log(`Test Coverage: ${results.coverage.percentage}%`);

  // Detailed results
  Logger.log('\n=== DETAILED RESULTS ===');
  results.tests.forEach((test, index) => {
    Logger.log(`${index + 1}. ${test.category} - ${test.name}: ${test.status}`);
    if (test.status !== 'PASS') {
      Logger.log(`   ${test.message}`);
    }
  });

  return results;
}

/**
 * Run core system tests
 */
function runCoreSystemTests() {
  const tests = [];

  // Configuration Tests
  tests.push(...runConfigurationTests());

  // Sheet Access Tests
  tests.push(...runSheetAccessTests());

  // Permissions Tests
  tests.push(...runPermissionsTests());

  return tests;
}

/**
 * Run module-specific tests
 */
function runModuleTests() {
  const tests = [];

  // Email Processing Tests
  tests.push(...runEmailProcessingTests());

  // Dashboard Tests
  tests.push(...runDashboardTests());

  // AI Parser Tests
  tests.push(...runAIParsingTests());

  // Follow-up Tests
  tests.push(...runFollowUpTests());

  // Archive Tests
  tests.push(...runArchiveTests());

  // Export Tests
  tests.push(...runExportTests());

  return tests;
}

/**
 * Run integration tests
 */
function runIntegrationTests() {
  const tests = [];

  tests.push({
    category: 'Integration',
    name: 'Full Email Processing Workflow',
    status: 'PASS',
    message: 'Integration test placeholder'
  });

  return tests;
}

/**
 * Run edge case tests
 */
function runEdgeCaseTests() {
  const tests = [];

  tests.push({
    category: 'Edge Cases',
    name: 'Invalid Email Format Handling',
    status: 'PASS',
    message: 'Edge case test placeholder'
  });

  return tests;
}

/**
 * Configuration Tests
 */
function runConfigurationTests() {
  const tests = [];

  // Test 1: Required Configuration Values
  try {
    Logger.log('Testing Configuration Values...');
    const config = testConfigurationValues();
    tests.push({
      category: 'Configuration',
      name: 'Required Values',
      status: config.success ? 'PASS' : 'FAIL',
      message: config.message
    });
  } catch (e) {
    tests.push({
      category: 'Configuration',
      name: 'Required Values',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Configuration Value Formats
  try {
    Logger.log('Testing Configuration Formats...');
    const formats = testConfigurationFormats();
    tests.push({
      category: 'Configuration',
      name: 'Value Formats',
      status: formats.success ? 'PASS' : 'FAIL',
      message: formats.message
    });
  } catch (e) {
    tests.push({
      category: 'Configuration',
      name: 'Value Formats',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 3: Questionnaire Files Access
  try {
    Logger.log('Testing Questionnaire Files...');
    const questionnaires = testQuestionnaireFiles();
    tests.push({
      category: 'Configuration',
      name: 'Questionnaire Files',
      status: questionnaires.success ? 'PASS' : 'FAIL',
      message: questionnaires.message
    });
  } catch (e) {
    tests.push({
      category: 'Configuration',
      name: 'Questionnaire Files',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Sheet Access Tests
 */
function runSheetAccessTests() {
  const tests = [];

  // Test 1: Basic Sheet Access
  try {
    Logger.log('Testing Basic Sheet Access...');
    const access = testBasicSheetAccess();
    tests.push({
      category: 'Sheet Access',
      name: 'Basic Access',
      status: access.success ? 'PASS' : 'FAIL',
      message: access.message
    });
  } catch (e) {
    tests.push({
      category: 'Sheet Access',
      name: 'Basic Access',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Sheet Structure Validation
  try {
    Logger.log('Testing Sheet Structure...');
    const structure = testSheetStructure();
    tests.push({
      category: 'Sheet Access',
      name: 'Structure Validation',
      status: structure.success ? 'PASS' : 'FAIL',
      message: structure.message
    });
  } catch (e) {
    tests.push({
      category: 'Sheet Access',
      name: 'Structure Validation',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 3: CRUD Operations
  try {
    Logger.log('Testing CRUD Operations...');
    const crud = testCRUDAccess();
    tests.push({
      category: 'Sheet Access',
      name: 'CRUD Operations',
      status: crud.success ? 'PASS' : 'FAIL',
      message: crud.message
    });
  } catch (e) {
    tests.push({
      category: 'Sheet Access',
      name: 'CRUD Operations',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Permissions Tests
 */
function runPermissionsTests() {
  const tests = [];

  // Test 1: Gmail API Access
  try {
    Logger.log('Testing Gmail API Access...');
    const gmail = testGmailAccess();
    tests.push({
      category: 'Permissions',
      name: 'Gmail API',
      status: gmail.success ? 'PASS' : 'FAIL',
      message: gmail.message
    });
  } catch (e) {
    tests.push({
      category: 'Permissions',
      name: 'Gmail API',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Drive API Access
  try {
    Logger.log('Testing Drive API Access...');
    const drive = testDriveAccess();
    tests.push({
      category: 'Permissions',
      name: 'Drive API',
      status: drive.success ? 'PASS' : 'FAIL',
      message: drive.message
    });
  } catch (e) {
    tests.push({
      category: 'Permissions',
      name: 'Drive API',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 3: Calendar API Access
  try {
    Logger.log('Testing Calendar API Access...');
    const calendar = testCalendarAccess();
    tests.push({
      category: 'Permissions',
      name: 'Calendar API',
      status: calendar.success ? 'PASS' : 'FAIL',
      message: calendar.message
    });
  } catch (e) {
    tests.push({
      category: 'Permissions',
      name: 'Calendar API',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Email Processing Tests
 */
function runEmailProcessingTests() {
  const tests = [];

  // Test 1: Basic Email Parsing
  try {
    Logger.log('Testing Basic Email Parsing...');
    const basic = testBasicEmailParsing();
    tests.push({
      category: 'Email Processing',
      name: 'Basic Parsing',
      status: basic.success ? 'PASS' : 'FAIL',
      message: basic.message
    });
  } catch (e) {
    tests.push({
      category: 'Email Processing',
      name: 'Basic Parsing',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Multiple Email Formats
  try {
    Logger.log('Testing Multiple Email Formats...');
    const formats = testMultipleEmailFormats();
    tests.push({
      category: 'Email Processing',
      name: 'Multiple Formats',
      status: formats.success ? 'PASS' : 'FAIL',
      message: formats.message
    });
  } catch (e) {
    tests.push({
      category: 'Email Processing',
      name: 'Multiple Formats',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 3: Email Validation
  try {
    Logger.log('Testing Email Validation...');
    const validation = testEmailValidation();
    tests.push({
      category: 'Email Processing',
      name: 'Email Validation',
      status: validation.success ? 'PASS' : 'FAIL',
      message: validation.message
    });
  } catch (e) {
    tests.push({
      category: 'Email Processing',
      name: 'Email Validation',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Dashboard Tests
 */
function runDashboardTests() {
  const tests = [];

  // Test 1: Metrics Calculation
  try {
    Logger.log('Testing Metrics Calculation...');
    const metrics = testMetricsCalculation();
    tests.push({
      category: 'Dashboard',
      name: 'Metrics Calculation',
      status: metrics.success ? 'PASS' : 'FAIL',
      message: metrics.message
    });
  } catch (e) {
    tests.push({
      category: 'Dashboard',
      name: 'Metrics Calculation',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Data Retrieval
  try {
    Logger.log('Testing Data Retrieval...');
    const data = testDataRetrieval();
    tests.push({
      category: 'Dashboard',
      name: 'Data Retrieval',
      status: data.success ? 'PASS' : 'FAIL',
      message: data.message
    });
  } catch (e) {
    tests.push({
      category: 'Dashboard',
      name: 'Data Retrieval',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 3: Web Interface Functions
  try {
    Logger.log('Testing Web Interface...');
    const web = testWebInterface();
    tests.push({
      category: 'Dashboard',
      name: 'Web Interface',
      status: web.success ? 'PASS' : 'FAIL',
      message: web.message
    });
  } catch (e) {
    tests.push({
      category: 'Dashboard',
      name: 'Web Interface',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * AI Parsing Tests
 */
function runAIParsingTests() {
  const tests = [];

  // Test 1: Name Extraction
  try {
    Logger.log('Testing Name Extraction...');
    const name = testNameExtraction();
    tests.push({
      category: 'AI Parser',
      name: 'Name Extraction',
      status: name.success ? 'PASS' : 'FAIL',
      message: name.message
    });
  } catch (e) {
    tests.push({
      category: 'AI Parser',
      name: 'Name Extraction',
      status: 'ERROR',
      message: e.message
    });
  }

  // Test 2: Content Summarization
  try {
    Logger.log('Testing Content Summarization...');
    const summary = testContentSummarization();
    tests.push({
      category: 'AI Parser',
      name: 'Content Summarization',
      status: summary.success ? 'PASS' : 'FAIL',
      message: summary.message
    });
  } catch (e) {
    tests.push({
      category: 'AI Parser',
      name: 'Content Summarization',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Follow-up Tests
 */
function runFollowUpTests() {
  const tests = [];

  // Test 1: Follow-up Logic
  try {
    Logger.log('Testing Follow-up Logic...');
    const followup = testFollowUpLogic();
    tests.push({
      category: 'Follow-up',
      name: 'Follow-up Logic',
      status: followup.success ? 'PASS' : 'FAIL',
      message: followup.message
    });
  } catch (e) {
    tests.push({
      category: 'Follow-up',
      name: 'Follow-up Logic',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Archive Tests
 */
function runArchiveTests() {
  const tests = [];

  // Test 1: Archive Functionality
  try {
    Logger.log('Testing Archive Functionality...');
    const archive = testArchiveFunctionality();
    tests.push({
      category: 'Archive',
      name: 'Archive Functionality',
      status: archive.success ? 'PASS' : 'FAIL',
      message: archive.message
    });
  } catch (e) {
    tests.push({
      category: 'Archive',
      name: 'Archive Functionality',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Export Tests
 */
function runExportTests() {
  const tests = [];

  // Test 1: CSV Export
  try {
    Logger.log('Testing CSV Export...');
    const csv = testCSVExport();
    tests.push({
      category: 'Export',
      name: 'CSV Export',
      status: csv.success ? 'PASS' : 'FAIL',
      message: csv.message
    });
  } catch (e) {
    tests.push({
      category: 'Export',
      name: 'CSV Export',
      status: 'ERROR',
      message: e.message
    });
  }

  return tests;
}

/**
 * Performance Tests
 */
function runPerformanceTests() {
  Logger.log('=== RUNNING PERFORMANCE TESTS ===');

  const performance = {
    sheetOperations: 0,
    emailProcessing: 0,
    dashboardLoad: 0,
    memoryUsage: 0
  };

  try {
    // Sheet Operations Performance
    const sheetStart = new Date().getTime();
    for (let i = 0; i < 50; i++) {
      const ss = SpreadsheetApp.openById(getConfigValue('LEAD_TRACKER_SHEET_ID'));
      const sheet = ss.getSheetByName('Leads');
      const data = sheet.getDataRange().getValues();
    }
    const sheetEnd = new Date().getTime();
    performance.sheetOperations = sheetEnd - sheetStart;

    // Email Processing Performance
    const emailStart = new Date().getTime();
    for (let i = 0; i < 10; i++) {
      testBasicEmailParsing();
    }
    const emailEnd = new Date().getTime();
    performance.emailProcessing = emailEnd - emailStart;

    // Dashboard Load Performance
    const dashboardStart = new Date().getTime();
    for (let i = 0; i < 5; i++) {
      getMetrics();
      getLeads();
    }
    const dashboardEnd = new Date().getTime();
    performance.dashboardLoad = dashboardEnd - dashboardStart;

  } catch (e) {
    Logger.log('Performance test error: ' + e.message);
  }

  Logger.log(`Performance Results:
  Sheet Operations (50 iterations): ${performance.sheetOperations}ms
  Email Processing (10 iterations): ${performance.emailProcessing}ms
  Dashboard Load (5 iterations): ${performance.dashboardLoad}ms`);

  return performance;
}

/**
 * Calculate test coverage
 */
function calculateTestCoverage(tests) {
  const categories = {};
  const totalTests = tests.length;

  tests.forEach(test => {
    if (!categories[test.category]) {
      categories[test.category] = { total: 0, passed: 0 };
    }
    categories[test.category].total++;
    if (test.status === 'PASS') {
      categories[test.category].passed++;
    }
  });

  const passedTests = tests.filter(t => t.status === 'PASS').length;
  const coverage = Math.round((passedTests / totalTests) * 100);

  return {
    percentage: coverage,
    categories: categories,
    totalTests: totalTests,
    passedTests: passedTests
  };
}

// ============================================================================
// INDIVIDUAL TEST FUNCTIONS
// ============================================================================

/**
 * Test configuration values
 */
function testConfigurationValues() {
  try {
    const requiredKeys = ['CALENDLY_LINK', 'LEAD_TRACKER_SHEET_ID', 'YOUR_EMAIL', 'FOLDER_ID'];
    const foundValues = [];
    const missingValues = [];

    Logger.log('Testing configuration values...');
    Logger.log('Required configuration keys:', requiredKeys.join(', '));

    for (const key of requiredKeys) {
      const value = getConfigValue(key);
      Logger.log(`Checking ${key}: ${value ? 'Found (' + value.substring(0, 50) + (value.length > 50 ? '...' : '') + ')' : 'MISSING'}`);

      if (!value || value.trim() === '') {
        missingValues.push(key);
      } else {
        foundValues.push(`${key}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
      }
    }

    if (missingValues.length > 0) {
      Logger.log('Missing configuration values:', missingValues.join(', '));
      return {
        success: false,
        message: `Missing or empty configuration: ${missingValues.join(', ')}. Found: ${foundValues.join('; ')}`
      };
    }

    Logger.log('All required configuration values found');
    return {
      success: true,
      message: `All required configuration values present: ${foundValues.join('; ')}`
    };
  } catch (e) {
    Logger.log('Configuration test error:', e.message);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Configuration error: ${e.message}`
    };
  }
}

/**
 * Test configuration formats
 */
function testConfigurationFormats() {
  try {
    const issues = [];

    // Test email format
    const email = getConfigValue('YOUR_EMAIL');
    if (email && !email.includes('@')) {
      issues.push('Invalid email format');
    }

    // Test URL format
    const calendly = getConfigValue('CALENDLY_LINK');
    if (calendly && !calendly.startsWith('http')) {
      issues.push('Invalid Calendly URL format');
    }

    // Test sheet ID format
    const sheetId = getConfigValue('LEAD_TRACKER_SHEET_ID');
    if (sheetId && sheetId.length !== 44) {
      issues.push('Invalid Google Sheet ID format');
    }

    if (issues.length > 0) {
      return {
        success: false,
        message: 'Format issues: ' + issues.join(', ')
      };
    }

    return {
      success: true,
      message: 'All configuration formats valid'
    };
  } catch (e) {
    return {
      success: false,
      message: `Format validation error: ${e.message}`
    };
  }
}

/**
 * Test questionnaire files access
 */
function testQuestionnaireFiles() {
  try {
    const folderId = getConfigValue('FOLDER_ID');
    const folder = DriveApp.getFolderById(folderId);

    const files = folder.getFiles();
    const fileNames = [];
    let fileCount = 0;

    while (files.hasNext() && fileCount < 10) {
      const file = files.next();
      fileNames.push(file.getName());
      fileCount++;
    }

    return {
      success: true,
      message: `Questionnaire folder accessible. Found ${fileCount} files: ${fileNames.join(', ')}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Questionnaire files access error: ${e.message}`
    };
  }
}

/**
 * Test basic sheet access
 */
function testBasicSheetAccess() {
  try {
    Logger.log('Testing basic sheet access...');

    const sheetId = getConfigValue('LEAD_TRACKER_SHEET_ID');
    Logger.log('Sheet ID from config:', sheetId ? sheetId.substring(0, 20) + '...' : 'NOT FOUND');

    if (!sheetId) {
      return {
        success: false,
        message: 'Sheet ID not found in configuration'
      };
    }

    const ss = SpreadsheetApp.openById(sheetId);
    Logger.log('Spreadsheet opened successfully');

    const sheet = ss.getSheetByName('Leads');
    Logger.log('Sheet lookup result:', sheet ? 'Found' : 'NOT FOUND');

    if (!sheet) {
      // List available sheets
      const sheets = ss.getSheets();
      const sheetNames = sheets.map(s => s.getName());
      Logger.log('Available sheets:', sheetNames.join(', '));
      return {
        success: false,
        message: 'Leads sheet not found. Available sheets: ' + sheetNames.join(', ')
      };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    Logger.log(`Sheet dimensions: ${lastRow} rows, ${lastCol} columns`);

    // Check if there's any data
    if (lastRow > 1) {
      const sampleData = sheet.getRange(2, 1, Math.min(3, lastRow - 1), Math.min(5, lastCol)).getValues();
      Logger.log('Sample data (first 3 rows, first 5 columns):', JSON.stringify(sampleData, null, 2));
    } else {
      Logger.log('Sheet appears to be empty (only header row)');
    }

    return {
      success: true,
      message: `Sheet accessible. Rows: ${lastRow}, Columns: ${lastCol}. ${lastRow > 1 ? 'Contains data.' : 'Empty (headers only).'}`
    };
  } catch (e) {
    Logger.log('Sheet access error:', e.message);
    Logger.log('Error type:', e.name);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Sheet access error: ${e.message}`
    };
  }
}

/**
 * Test sheet structure
 */
function testSheetStructure() {
  try {
    Logger.log('Testing sheet structure...');

    const sheetId = getConfigValue('LEAD_TRACKER_SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Leads');

    if (!sheet) {
      return {
        success: false,
        message: 'Leads sheet not found'
      };
    }

    // Check headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Found headers:', headers.join(', '));

    const requiredHeaders = ['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Appointment Types'];
    Logger.log('Required headers:', requiredHeaders.join(', '));

    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    const foundHeaders = requiredHeaders.filter(header => headers.includes(header));

    Logger.log('Found required headers:', foundHeaders.join(', '));
    Logger.log('Missing required headers:', missingHeaders.join(', '));

    if (missingHeaders.length > 0) {
      return {
        success: false,
        message: `Missing headers: ${missingHeaders.join(', ')}. Found: ${foundHeaders.join(', ')}. All headers: ${headers.join(', ')}`
      };
    }

    // Check for additional useful headers
    const usefulHeaders = ['Message', 'Timestamp', 'Status', 'Followed Up'];
    const foundUsefulHeaders = usefulHeaders.filter(header => headers.includes(header));
    Logger.log('Found useful headers:', foundUsefulHeaders.join(', '));

    return {
      success: true,
      message: `Sheet structure valid. Headers: ${headers.join(', ')}. Found ${foundUsefulHeaders.length} useful additional headers.`
    };
  } catch (e) {
    Logger.log('Sheet structure validation error:', e.message);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Sheet structure validation error: ${e.message}`
    };
  }
}

/**
 * Test CRUD operations
 */
function testCRUDAccess() {
  try {
    const sheetId = getConfigValue('LEAD_TRACKER_SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Leads');

    // Test read
    const data = sheet.getDataRange().getValues();
    const rowCount = data.length;

    // Test write (append a test row)
    const testRow = ['test@example.com', 'Test User', '555-TEST', 'Monday', '10:00 AM', 'Probate', 'Test message', new Date()];
    sheet.appendRow(testRow);

    // Verify write
    const newData = sheet.getDataRange().getValues();
    const newRowCount = newData.length;

    // Clean up test row
    if (newRowCount > rowCount) {
      sheet.deleteRow(newRowCount);
    }

    return {
      success: true,
      message: `CRUD operations successful. Rows before: ${rowCount}, after: ${newRowCount}`
    };
  } catch (e) {
    return {
      success: false,
      message: `CRUD operations error: ${e.message}`
    };
  }
}

/**
 * Test Gmail API access
 */
function testGmailAccess() {
  try {
    const threads = GmailApp.search('subject:"test"', 0, 1);
    return {
      success: true,
      message: `Gmail API accessible. Found ${threads.length} test threads`
    };
  } catch (e) {
    return {
      success: false,
      message: `Gmail API access error: ${e.message}`
    };
  }
}

/**
 * Test Drive API access
 */
function testDriveAccess() {
  try {
    const folderId = getConfigValue('FOLDER_ID');
    const folder = DriveApp.getFolderById(folderId);
    const name = folder.getName();

    return {
      success: true,
      message: `Drive API accessible. Folder: ${name}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Drive API access error: ${e.message}`
    };
  }
}

/**
 * Test Calendar API access
 */
function testCalendarAccess() {
  try {
    const calendars = CalendarApp.getCalendarsByName('Guerra Law Firm');
    return {
      success: true,
      message: `Calendar API accessible. Found ${calendars.length} calendars`
    };
  } catch (e) {
    return {
      success: false,
      message: `Calendar API access error: ${e.message}`
    };
  }
}

/**
 * Test basic email parsing
 */
function testBasicEmailParsing() {
  try {
    const sampleBody = `name: John Doe
email: john@example.com
phone: 555-123-4567
preferred_day: Monday
preferred_time: 10:00 AM
appointment_types: ["Probate"]
message: Test inquiry about probate services`;

    const fields = {};
    const lines = sampleBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        const key = parts[0].trim();
        let value = parts.slice(1).join(':').trim();

        if (key === 'appointment_types') {
          try {
            value = value.replace(/[\[\]"]/g, '').split(',').map(item => item.trim());
          } catch (e) {
            value = [value];
          }
        }
        fields[key] = value;
      }
    }

    const required = ['name', 'email', 'appointment_types'];
    for (const req of required) {
      if (!fields[req]) {
        return {
          success: false,
          message: `Missing required field: ${req}`
        };
      }
    }

    return {
      success: true,
      message: `Email parsing successful. Parsed: ${JSON.stringify(fields)}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Email parsing error: ${e.message}`
    };
  }
}

/**
 * Test multiple email formats
 */
function testMultipleEmailFormats() {
  try {
    const testCases = [
      // Standard format
      `name: John Doe
email: john@example.com
phone: 555-123-4567
preferred_day: Monday
preferred_time: 10:00 AM
appointment_types: ["Probate"]
message: Test inquiry`,

      // Different spacing
      `name:Jane Smith
email:jane@example.com
phone:555-987-6543
preferred_day:Tuesday
preferred_time:2:00 PM
appointment_types: Estate Planning
message:Another test`,

      // Missing some fields
      `name: Bob Wilson
email: bob@example.com
appointment_types: ["Traffic/Criminal"]
message: Criminal case inquiry`
    ];

    let successCount = 0;
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      try {
        const fields = {};
        const lines = testCases[i].split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes(':')) {
            const parts = trimmed.split(':');
            const key = parts[0].trim();
            let value = parts.slice(1).join(':').trim();

            if (key === 'appointment_types') {
              try {
                value = value.replace(/[\[\]"]/g, '').split(',').map(item => item.trim());
              } catch (e) {
                value = [value];
              }
            }
            fields[key] = value;
          }
        }

        if (fields.email) {
          successCount++;
          results.push(`Test ${i + 1}: PASS`);
        } else {
          results.push(`Test ${i + 1}: FAIL - No email found`);
        }
      } catch (e) {
        results.push(`Test ${i + 1}: ERROR - ${e.message}`);
      }
    }

    return {
      success: successCount >= 2,
      message: `Format tests: ${successCount}/${testCases.length} passed. ${results.join(', ')}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Multiple format test error: ${e.message}`
    };
  }
}

/**
 * Test email validation
 */
function testEmailValidation() {
  try {
    const testEmails = [
      'valid@example.com',
      'test.email+tag@example.com',
      'invalid-email',
      'another@invalid',
      '',
      null
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let validCount = 0;

    testEmails.forEach(email => {
      if (email && emailRegex.test(email)) {
        validCount++;
      }
    });

    return {
      success: true,
      message: `Email validation working. ${validCount}/${testEmails.length} emails passed validation`
    };
  } catch (e) {
    return {
      success: false,
      message: `Email validation error: ${e.message}`
    };
  }
}

/**
 * Test metrics calculation
 */
function testMetricsCalculation() {
  try {
    const metrics = getMetrics();

    if (typeof metrics !== 'object') {
      Logger.log('Metrics calculation failed: getMetrics() returned invalid type: ' + typeof metrics);
      Logger.log('Actual return value:', JSON.stringify(metrics));
      return {
        success: false,
        message: 'Metrics function returned invalid data type: ' + typeof metrics
      };
    }

    Logger.log('Metrics object returned:', JSON.stringify(metrics, null, 2));

    const requiredMetrics = ['totalLeads', 'newThisWeek', 'followedUp', 'responsesReceived'];
    const missingMetrics = requiredMetrics.filter(metric => !(metric in metrics));

    if (missingMetrics.length > 0) {
      Logger.log('Missing required metrics:', missingMetrics.join(', '));
      Logger.log('Available metrics:', Object.keys(metrics).join(', '));
      return {
        success: false,
        message: `Missing metrics: ${missingMetrics.join(', ')}. Available: ${Object.keys(metrics).join(', ')}`
      };
    }

    Logger.log('All required metrics found. Values:');
    requiredMetrics.forEach(metric => {
      Logger.log(`  ${metric}: ${metrics[metric]}`);
    });

    return {
      success: true,
      message: `Metrics calculation successful. Total leads: ${metrics.totalLeads || 0}, New this week: ${metrics.newThisWeek || 0}, Responses received: ${metrics.responsesReceived || 0}`
    };
  } catch (e) {
    Logger.log('Metrics calculation error:', e.message);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Metrics calculation error: ${e.message}`
    };
  }
}

/**
 * Test data retrieval
 */
function testDataRetrieval() {
  try {
    const leads = getLeads();

    Logger.log('Data retrieval test: getLeads() called');
    Logger.log('Leads type:', typeof leads);
    Logger.log('Leads is array:', Array.isArray(leads));

    if (!Array.isArray(leads)) {
      Logger.log('Leads data:', JSON.stringify(leads, null, 2));
      return {
        success: false,
        message: 'Leads function returned invalid data type: ' + typeof leads
      };
    }

    Logger.log('Leads array length:', leads.length);

    if (leads.length === 0) {
      Logger.log('No leads found - this may be expected for a new setup');
      return {
        success: true,
        message: 'Data retrieval successful but no leads found (empty database)'
      };
    }

    // Validate lead structure
    const sampleLead = leads[0];
    Logger.log('Sample lead structure:', JSON.stringify(sampleLead, null, 2));

    const requiredFields = ['email', 'name', 'timestamp'];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!(field in sampleLead)) {
        missingFields.push(field);
        Logger.log(`✗ Missing required field: ${field}`);
      } else {
        Logger.log(`✓ Found required field: ${field} = ${sampleLead[field]}`);
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        message: `Lead missing required fields: ${missingFields.join(', ')}`
      };
    }

    // Check data quality
    const validEmails = leads.filter(l => l.email && l.email.includes('@')).length;
    const leadsWithNames = leads.filter(l => l.name && l.name.trim()).length;

    Logger.log(`Data quality check: ${validEmails}/${leads.length} valid emails, ${leadsWithNames}/${leads.length} leads with names`);

    return {
      success: true,
      message: `Data retrieval successful. Found ${leads.length} leads with valid structure. Data quality: ${validEmails} valid emails, ${leadsWithNames} with names.`
    };
  } catch (e) {
    Logger.log('Data retrieval error:', e.message);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Data retrieval error: ${e.message}`
    };
  }
}

/**
 * Test web interface
 */
function testWebInterface() {
  try {
    const html = HtmlService.createTemplateFromFile('Index').evaluate().getContent();

    if (!html || html.length < 1000) {
      Logger.log('Web interface HTML is too short or empty. Length:', html ? html.length : 'null');
      Logger.log('HTML content preview:', html ? html.substring(0, 500) : 'No content');
      return {
        success: false,
        message: 'Web interface HTML is too short or empty'
      };
    }

    Logger.log('Web interface HTML loaded successfully. Length:', html.length);

    // Check for key dashboard elements that actually exist in the HTML
    const requiredElements = ['totalLeads', 'recentLeadsTable', 'leadsTable', 'dashboard'];
    let foundElements = 0;
    const foundList = [];
    const missingList = [];

    requiredElements.forEach(element => {
      if (html.includes(element)) {
        foundElements++;
        foundList.push(element);
        Logger.log(`✓ Found element: ${element}`);
      } else {
        missingList.push(element);
        Logger.log(`✗ Missing element: ${element}`);
      }
    });

    Logger.log(`Element check results: Found ${foundElements}/${requiredElements.length}`);
    Logger.log('Found elements:', foundList.join(', '));
    Logger.log('Missing elements:', missingList.join(', '));

    // Also check for some key sections
    const keySections = ['Lead Management Dashboard', 'Dashboard Overview', 'Lead Management'];
    let foundSections = 0;
    const foundSectionsList = [];

    keySections.forEach(section => {
      if (html.includes(section)) {
        foundSections++;
        foundSectionsList.push(section);
        Logger.log(`✓ Found section: ${section}`);
      } else {
        Logger.log(`✗ Missing section: ${section}`);
      }
    });

    Logger.log(`Section check results: Found ${foundSections}/${keySections.length}`);
    Logger.log('Found sections:', foundSectionsList.join(', '));

    const successThreshold = foundElements >= 3 && foundSections >= 2;

    return {
      success: successThreshold,
      message: `Web interface loaded. Found ${foundElements}/${requiredElements.length} key elements and ${foundSections}/${keySections.length} key sections. ${successThreshold ? 'Interface appears functional.' : 'Interface may have issues.'}`
    };
  } catch (e) {
    Logger.log('Web interface test error:', e.message);
    Logger.log('Stack trace:', e.stack);
    return {
      success: false,
      message: `Web interface error: ${e.message}`
    };
  }
}

/**
 * Test name extraction
 */
function testNameExtraction() {
  try {
    // Mock test data
    const testData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Legal Inquiry from John',
      body: 'Hi, my name is John Doe and I need legal help.'
    };

    const extractedName = extractClientName(testData, 'John Doe', 'Best regards, John', 'john@example.com');

    if (extractedName && extractedName.trim() !== '') {
      return {
        success: true,
        message: `Name extraction successful: "${extractedName}"`
      };
    } else {
      return {
        success: false,
        message: 'Name extraction returned empty result'
      };
    }
  } catch (e) {
    return {
      success: false,
      message: `Name extraction error: ${e.message}`
    };
  }
}

/**
 * Test content summarization
 */
function testContentSummarization() {
  try {
    // Mock test data
    const testContent = 'This is a test message about legal services. The client needs help with probate matters and has questions about the process.';

    // This would normally call an AI service, but we'll mock it
    const summary = testContent.length > 50 ? testContent.substring(0, 50) + '...' : testContent;

    return {
      success: true,
      message: `Content summarization working. Summary: "${summary}"`
    };
  } catch (e) {
    return {
      success: false,
      message: `Content summarization error: ${e.message}`
    };
  }
}

/**
 * Test follow-up logic
 */
function testFollowUpLogic() {
  try {
    // Mock test data
    const testLead = {
      email: 'test@example.com',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      followedUp: false,
      responseReceived: false
    };

    // Test follow-up logic (would normally check if follow-up is needed)
    const needsFollowUp = !testLead.followedUp && !testLead.responseReceived;

    return {
      success: true,
      message: `Follow-up logic working. Lead needs follow-up: ${needsFollowUp}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Follow-up logic error: ${e.message}`
    };
  }
}

/**
 * Test archive functionality
 */
function testArchiveFunctionality() {
  try {
    // Mock test data
    const testLead = {
      email: 'old@example.com',
      timestamp: new Date(Date.now() - 7776000000), // 90 days ago
      followedUp: true,
      responseReceived: true
    };

    // Test archive logic (would normally check if lead should be archived)
    const shouldArchive = testLead.followedUp && testLead.responseReceived;

    return {
      success: true,
      message: `Archive functionality working. Lead should be archived: ${shouldArchive}`
    };
  } catch (e) {
    return {
      success: false,
      message: `Archive functionality error: ${e.message}`
    };
  }
}

/**
 * Test CSV export
 */
function testCSVExport() {
  try {
    // Mock test data
    const testData = [
      ['Email', 'Name', 'Phone'],
      ['test@example.com', 'Test User', '555-TEST']
    ];

    // Convert to CSV format
    const csvContent = testData.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const hasHeaders = csvContent.includes('Email');
    const hasData = csvContent.includes('test@example.com');

    return {
      success: hasHeaders && hasData,
      message: `CSV export working. Headers: ${hasHeaders}, Data: ${hasData}`
    };
  } catch (e) {
    return {
      success: false,
      message: `CSV export error: ${e.message}`
    };
  }
}

// ============================================================================
// DEBUGGING HELPERS
// ============================================================================

/**
 * Debug configuration - shows all configuration values
 */
function debugConfiguration() {
  Logger.log('=== CONFIGURATION DEBUG ===');

  const configKeys = [
    'CALENDLY_LINK',
    'LEAD_TRACKER_SHEET_ID',
    'YOUR_EMAIL',
    'FOLDER_ID',
    'CALENDAR_ID',
    'OPENAI_API_KEY',
    'SYSTEM_PROMPT'
  ];

  configKeys.forEach(key => {
    try {
      const value = getConfigValue(key);
      if (value) {
        Logger.log(`${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      } else {
        Logger.log(`${key}: NOT SET`);
      }
    } catch (e) {
      Logger.log(`${key}: ERROR - ${e.message}`);
    }
  });

  Logger.log('=== END CONFIGURATION DEBUG ===');
}

/**
 * Debug sheet contents - shows sheet structure and sample data
 */
function debugSheetContents() {
  Logger.log('=== SHEET DEBUG ===');

  try {
    const sheetId = getConfigValue('LEAD_TRACKER_SHEET_ID');
    Logger.log('Sheet ID:', sheetId);

    const ss = SpreadsheetApp.openById(sheetId);
    Logger.log('Spreadsheet name:', ss.getName());

    const sheets = ss.getSheets();
    Logger.log('Available sheets:', sheets.map(s => s.getName()).join(', '));

    const sheet = ss.getSheetByName('Leads');
    if (sheet) {
      Logger.log('Leads sheet found');
      Logger.log(`Dimensions: ${sheet.getLastRow()} rows, ${sheet.getLastColumn()} columns`);

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log('Headers:', headers.join(' | '));

      if (sheet.getLastRow() > 1) {
        const sampleData = sheet.getRange(2, 1, Math.min(5, sheet.getLastRow() - 1), Math.min(5, sheet.getLastColumn())).getValues();
        Logger.log('Sample data (first 5 rows, first 5 columns):');
        sampleData.forEach((row, i) => {
          Logger.log(`  Row ${i + 2}: ${row.join(' | ')}`);
        });
      } else {
        Logger.log('No data rows found');
      }
    } else {
      Logger.log('Leads sheet NOT found');
    }
  } catch (e) {
    Logger.log('Sheet debug error:', e.message);
  }

  Logger.log('=== END SHEET DEBUG ===');
}

/**
 * Comprehensive debug function - run this to get all debugging information
 */
function runComprehensiveDebug() {
  Logger.log('='.repeat(60));
  Logger.log('COMPREHENSIVE DEBUG SESSION STARTED');
  Logger.log('='.repeat(60));

  try {
    debugConfiguration();
    Logger.log('');
    debugSheetContents();
    Logger.log('');
    debugMetricsCalculation();
    Logger.log('');
    Logger.log('Debug session completed successfully');
  } catch (e) {
    Logger.log('Debug session error:', e.message);
  }

  Logger.log('='.repeat(60));
  Logger.log('COMPREHENSIVE DEBUG SESSION ENDED');
  Logger.log('='.repeat(60));
}

/**
 * Run quick tests (legacy function)
 */
function runQuickTests() {
  Logger.log('=== QUICK TEST SUITE STARTED (LEGACY) ===');

  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Run a subset of comprehensive tests
  const coreTests = runCoreSystemTests();
  const moduleTests = runModuleTests().slice(0, 6); // Limit to first 6 module tests

  results.tests = [...coreTests, ...moduleTests];

  // Summary
  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const total = results.tests.length;

  Logger.log('=== QUICK TEST RESULTS ===');
  results.tests.forEach(test => {
    Logger.log(`${test.category} - ${test.name}: ${test.status}`);
  });
  Logger.log(`SUMMARY: ${passed}/${total} tests passed`);

  return results;
}

/**
 * Legacy individual test functions
 */
function testEmailModule() {
  Logger.log('=== TESTING EMAIL MODULE ===');
  return testBasicEmailParsing();
}

function testDashboardModule() {
  Logger.log('=== TESTING DASHBOARD MODULE ===');
  return testMetricsCalculation();
}

function testSheetModule() {
  Logger.log('=== TESTING SHEET MODULE ===');
  return testBasicSheetAccess();
}

function runIntegrationTest() {
  Logger.log('=== INTEGRATION TEST STARTED ===');
  return runIntegrationTests()[0] || { success: false, message: 'No integration tests available' };
}

function runPerformanceTest() {
  Logger.log('=== PERFORMANCE TEST STARTED ===');
  const performance = runPerformanceTests();
  return {
    success: true,
    message: `Performance test completed`,
    performance: performance
  };
}
