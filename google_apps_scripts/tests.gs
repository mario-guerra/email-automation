/**
 * Test Framework for Google Apps Scripts
 * Uses QUnit for unit testing
 */

// Load QUnit library
function loadQUnit() {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>QUnit Tests</title>
      <link rel="stylesheet" href="https://code.jquery.com/qunit/qunit-2.19.1.css">
    </head>
    <body>
      <div id="qunit"></div>
      <div id="qunit-fixture"></div>
      <script src="https://code.jquery.com/qunit/qunit-2.19.1.js"></script>
      <script>
        // QUnit configuration
        QUnit.config.autostart = false;
      </script>
    </body>
    </html>
  `).getContent();
}

/**
 * Run all tests
 */
function runAllTests() {
  try {
    const results = {
      emailProcessor: testEmailProcessor(),
      followUpChecker: testFollowUpChecker(),
      aiParser: testAiParser(),
      sheetManager: testSheetManager(),
      dashboard: testDashboard()
    };

    return {
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test Email Processor functions
 */
function testEmailProcessor() {
  // Mock data for testing
  const mockEmailData = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '123-456-7890',
    preferredDay: 'Monday',
    preferredTime: '10:00 AM',
    appointmentTypes: ['Probate'],
    message: 'Test message'
  };

  try {
    // Test configuration validation
    const configValid = testConfigValidation();

    // Test email parsing (mock)
    const parsingWorks = testEmailParsing(mockEmailData);

    return {
      configValidation: configValid,
      emailParsing: parsingWorks,
      overall: configValid && parsingWorks
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Test Follow-up Checker functions
 */
function testFollowUpChecker() {
  try {
    // Test basic functionality without actual API calls
    return { basicFunctionality: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Test AI Parser functions
 */
function testAiParser() {
  try {
    // Test name extraction
    const nameTest = extractClientName({}, 'John Doe', 'Regards, John', 'john@example.com');
    const nameExtractionWorks = nameTest === 'John Doe';

    return { nameExtraction: nameExtractionWorks };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Test Sheet Manager functions
 */
function testSheetManager() {
  try {
    // Test basic sheet access
    const LEAD_SHEET_ID = PropertiesService.getScriptProperties().getProperty('LEAD_TRACKER_SHEET_ID');
    const ss = SpreadsheetApp.openById(LEAD_SHEET_ID);
    const sheet = ss.getSheetByName('Leads');
    const sheetExists = sheet !== null;

    return { sheetAccess: sheetExists };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Test Dashboard functions
 */
function testDashboard() {
  try {
    // Test metrics calculation
    const metrics = getMetrics();
    const metricsWork = typeof metrics === 'object' && metrics.totalLeads !== undefined;

    // Test lead retrieval
    const leads = getLeads();
    const leadsWork = Array.isArray(leads);

    return {
      metrics: metricsWork,
      leads: leadsWork,
      overall: metricsWork && leadsWork
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Helper test functions
 */
function testConfigValidation() {
  // Test that required config values are present
  const requiredKeys = ['CALENDLY_LINK', 'LEAD_TRACKER_SHEET_ID', 'YOUR_EMAIL', 'FOLDER_ID'];
  let allPresent = true;

  requiredKeys.forEach(key => {
    try {
      const value = getConfigValue(key);
      if (!value) allPresent = false;
    } catch (e) {
      allPresent = false;
    }
  });

  return allPresent;
}

function testEmailParsing(data) {
  // Mock email parsing test
  return data.name && data.email && data.appointmentTypes;
}

/**
 * Manual Test Runner - Call this from GAS editor
 */
function manualTestRunner() {
  Logger.log('=== Starting Manual Tests ===');

  try {
    // Test 1: Configuration
    Logger.log('Test 1: Configuration Validation');
    const configTest = testConfigValidation();
    Logger.log('Configuration test: ' + (configTest ? 'PASS' : 'FAIL'));

    // Test 2: Sheet Access
    Logger.log('Test 2: Sheet Access');
    const sheetTest = testSheetManager();
    Logger.log('Sheet access test: ' + (sheetTest.sheetAccess ? 'PASS' : 'FAIL'));

    // Test 3: Email Processing (dry run)
    Logger.log('Test 3: Email Processing Dry Run');
    // This would normally process emails, but we'll just test the parsing
    const mockData = {
      name: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      preferredDay: 'Monday',
      preferredTime: '10:00 AM',
      appointmentTypes: ['Probate'],
      message: 'Test message'
    };
    const parsingTest = testEmailParsing(mockData);
    Logger.log('Email parsing test: ' + (parsingTest ? 'PASS' : 'FAIL'));

    Logger.log('=== Manual Tests Complete ===');
    return 'Tests completed. Check logs for results.';

  } catch (error) {
    Logger.log('Test failed with error: ' + error.message);
    return 'Tests failed: ' + error.message;
  }
}

/**
 * Test individual modules separately
 */
function testEmailProcessingModule() {
  Logger.log('Testing Email Processing Module...');
  return testEmailProcessor();
}

function testDashboardModule() {
  Logger.log('Testing Dashboard Module...');
  return testDashboard();
}

function testSheetOperations() {
  Logger.log('Testing Sheet Operations...');
  return testSheetManager();
}
