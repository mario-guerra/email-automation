/**
 * Web Interface Module
 * Handles web app serving and HTML template inclusion
 */

/**
 * Serves the main dashboard HTML page
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Lead Management Dashboard - Guerra Law Firm')
    .setFaviconUrl('https://www.gstatic.com/images/branding/product/1x/gsheets_24dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes HTML files for templating
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
