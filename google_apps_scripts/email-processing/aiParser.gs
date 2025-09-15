/**
 * AI Parser Module
 * Handles AI-powered text parsing and executive summary generation
 */

/**
 * Generates executive summary using AI
 */
function generateExecutiveSummary(emailContent, clientName) {
  if (!ENABLE_AI_SUMMARY) {
    console.log('AI Summary feature is disabled');
    return 'AI Summary disabled';
  }

  console.log('Generating AI summary for email content length: ' + emailContent.length);
  // Implement retry with exponential backoff for transient AI errors
  var maxAttempts = 3;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + AI_API_KEY;
      var clientHint = clientName ? ('Client name (preferred): ' + clientName + '\n\n') : '';
      var prompt = 'Summarize the key points from this lead\'s email response to our questionnaire. If a preferred client name is provided, use that name when referring to the client in the summary. Focus on their answers, expressed concerns, overall sentiment, and highlight anything important to know from a legal standpoint. Call out anything that merits a closer read of the email and/or questionnaire answers. Keep it under 200 words. Use "Important points:" for the highlighted section.\n\n' + clientHint + 'Email Content:\n' + emailContent;
      var payload = {
        'contents': [{
          'parts': [{ 'text': prompt }]
        }]
      };
      var options = {
        'method': 'post',
        'contentType': 'application/json',
        'payload': JSON.stringify(payload),
        'muteHttpExceptions': true
      };
      console.log('Calling Gemini API (attempt ' + attempt + ')...');
      var response = UrlFetchApp.fetch(url, options);
      var contentText = response.getContentText();
      var json = {};
      try { json = JSON.parse(contentText); } catch (pe) { throw new Error('Invalid JSON from AI: ' + pe + ' -- ' + contentText); }
      if (json.error) {
        throw new Error('AI API error: ' + JSON.stringify(json.error));
      }
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
        var summary = json.candidates[0].content.parts[0].text.trim();
        console.log('AI summary generated successfully, length: ' + summary.length);
        return summary;
      }
      throw new Error('AI API error: Invalid response structure - ' + JSON.stringify(json));
    } catch (e) {
      console.log('AI summary attempt ' + attempt + ' failed: ' + e);
      if (attempt < maxAttempts) {
        var backoff = 1000 * Math.pow(2, attempt - 1);
        console.log('Retrying AI summary after ' + backoff + 'ms...');
        Utilities.sleep(backoff);
        continue;
      }
      console.log('AI summary failed after ' + maxAttempts + ' attempts.');
      return 'Summary unavailable - manual review needed.';
    }
  }
}

/**
 * Parses reply using AI
 */
function parseReplyWithAI(text) {
  if (!ENABLE_AI_SUMMARY || !AI_API_KEY) return null;
  var maxAttemptsAI = 3;
  for (var attemptAI = 1; attemptAI <= maxAttemptsAI; attemptAI++) {
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + AI_API_KEY;
      var prompt = 'You are a strict JSON generator. Parse the following email reply into a single JSON object only. Keys must be the exact questionnaire question titles and values the respondent\'s answers. If an answer contains multiple items, return an array. Do NOT include any explanatory text, markdown, or commentary — return only valid JSON. If you cannot parse, return an empty JSON object {}.\n\nReply:\n' + text;
      var payload = { 'contents': [{ 'parts': [{ 'text': prompt }] }] };
      var options = { 'method': 'post', 'contentType': 'application/json', 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
      console.log('Calling AI parser (attempt ' + attemptAI + ')...');
      var response = UrlFetchApp.fetch(url, options);
      var contentText = response.getContentText();
      var json = {};
      try { json = JSON.parse(contentText); } catch (pe) { throw new Error('Invalid JSON from AI: ' + pe + ' -- ' + contentText); }
      if (json.error) {
        throw new Error('AI API error: ' + JSON.stringify(json.error));
      }
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
        var textOut = json.candidates[0].content.parts[0].text.trim();
        try { return JSON.parse(textOut); } catch (e) {
          var jsMatch = textOut.match(/(\{[\s\S]*\})/);
          if (jsMatch) {
            try { return JSON.parse(jsMatch[1]); } catch (e2) { return null; }
          }
        }
      }
      throw new Error('AI parser: Invalid response structure - ' + JSON.stringify(json));
    } catch (e) {
      console.log('AI parse attempt ' + attemptAI + ' failed: ' + e);
      if (attemptAI < maxAttemptsAI) {
        var backoffAI = 1000 * Math.pow(2, attemptAI - 1);
        Utilities.sleep(backoffAI);
        continue;
      }
      console.log('AI parser failed after ' + maxAttemptsAI + ' attempts.');
      return null;
    }
  }
}

/**
 * Parses reply using regex patterns
 */
function parseReplyWithRegex(text, appointmentTypesList) {
  var result = {};
  var cleanedText = '';
  if (!text) return { fields: result, cleaned: cleanedText };
  // Normalize newlines
  text = text.replace(/\r\n/g, '\n');
  // Remove quoted blocks commonly introduced by email clients (lines starting with >)
  text = text.split('\n').filter(function(l){ return !l.trim().startsWith('>'); }).join('\n');
  // Remove common reply headers (e.g., "On Wed, ... wrote:")
  text = text.replace(/\nOn\s.+wrote:\n[\s\S]*/i, '\n');
  // Remove signature separator and anything after it
  text = text.replace(/--\s?[\s\S]*$/m, ''); // signature separator
  // Trim leading/trailing whitespace
  text = text.trim();
  // If appointment types are provided, try to read the questionnaire files and extract question headings
  var questionCandidates = [];
  try {
    if (appointmentTypesList) {
      var types = (typeof appointmentTypesList === 'string') ? appointmentTypesList.split(',').map(function(s){return s.trim();}) : appointmentTypesList;
      var folder = DriveApp.getFolderById(FOLDER_ID);
      for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        if (!t) continue;
        var fileName = QUESTIONNAIRE_FILES[t];
        if (!fileName) continue;
        try {
          var files = folder.getFilesByName(fileName);
          if (files.hasNext()) {
            var f = files.next();
            try { console.log('parseReplyWithRegex: found template ' + fileName + ' (id=' + f.getId() + ')'); } catch (le) {}
            var qtext = f.getBlob().getDataAsString();
            var qlines = qtext.split(/\r?\n/);
            for (var ql = 0; ql < qlines.length; ql++) {
              var qltrim = qlines[ql].trim();
              if (!qltrim) continue;
              // consider lines that end with a question mark or look like numbered questions
              if (qltrim.match(/\?\s*$/) || qltrim.match(/^\d+\.|^[A-Z0-9\-]{3,}\:/)) {
                questionCandidates.push(qltrim.replace(/\s+$/, ''));
              }
            }
          }
        } catch (e) {
          // ignore file read errors
        }
      }
    }
  } catch (e) {
    // ignore Drive errors
  }

  // Normalize and dedupe question candidates
  var questions = [];
  var seen = {};
  for (var qi = 0; qi < questionCandidates.length; qi++) {
    var qq = questionCandidates[qi].replace(/^\d+\.\s*/, '').trim();
    if (!qq) continue;
    var key = qq.toLowerCase();
    if (!seen[key]) { seen[key] = true; questions.push(qq); }
  }

  // For each known question, try to find an answer following the question text in the reply
  var answersFound = [];
  for (var qj = 0; qj < questions.length; qj++) {
    var qtxt = questions[qj];
    var idx = text.toLowerCase().indexOf(qtxt.toLowerCase());
    if (idx !== -1) {
      var start = idx + qtxt.length;
      var rest = text.substring(start).trim();
      // stop at the next blank line or next question marker
      var stop = rest.search(/\n\s*\n/);
      var answer = stop === -1 ? rest : rest.substring(0, stop).trim();
      var key = qtxt.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (answer) {
        result[key] = answer;
        answersFound.push({question: qtxt, answer: answer});
      }
    }
  }

  // If we found answers by matching questions, build a cleanedText from those answers and return
  if (answersFound.length) {
    var linesOut = [];
    for (var aI = 0; aI < answersFound.length; aI++) {
      linesOut.push(answersFound[aI].question);
      linesOut.push(answersFound[aI].answer);
      linesOut.push('');
    }
    cleanedText = linesOut.join('\n').trim();
    return { fields: result, cleaned: cleanedText };
  }

  // Fallback: try to find an explicit 'Questionnaire' block in the reply before quoted material
  var qBlockMatch = text.match(/questionnaire[\s\S]*?:?\n([\s\S]*?)(?:\n\s*On\s|\n>\s|\nFrom:|\nSigned:|$)/i);
  if (qBlockMatch && qBlockMatch[1]) {
    var block = qBlockMatch[1].trim();
    // remove any repeated questionnaire template lines if present
    block = block.replace(/Traffic\/Criminal Questionnaire[\s\S]*/ig, function(m){ return m.split('\n').slice(0,50).join('\n'); });
    // Try to parse key:value within block
    var bLines = block.split(/\r?\n/);
    for (var bl = 0; bl < bLines.length; bl++) {
      var line = bLines[bl].trim();
      if (!line) continue;
      var m2b = line.match(/^([A-Za-z _-]{2,50}):\s*(.+)$/);
      if (m2b) {
        var k2b = m2b[1].trim();
        var v2b = m2b[2].trim();
        var key2b = k2b.toLowerCase().replace(/\s+/g, '_');
        if (v2b.indexOf(',') !== -1) v2b = v2b.split(',').map(function(s) { return s.trim(); });
        result[key2b] = v2b;
      }
    }
    cleanedText = block;
    return { fields: result, cleaned: cleanedText };
  }

  // Final fallback: split into lines and capture key: value pairs over the whole cleaned text
  var lines2 = text.split(/\r?\n/);
  var extractedLines = [];
  for (var li2 = 0; li2 < lines2.length; li2++) {
    var line = lines2[li2].trim();
    if (!line) continue;
    var m2 = line.match(/^([A-Za-z _-]{2,50}):\s*(.+)$/);
    if (m2) {
      var k2 = m2[1].trim();
      var v2 = m2[2].trim();
      var key2 = k2.toLowerCase().replace(/\s+/g, '_');
      if (v2.indexOf(',') !== -1) v2 = v2.split(',').map(function(s) { return s.trim(); });
      result[key2] = v2;
      extractedLines.push(line);
    }
  }
  if (extractedLines.length) cleanedText = extractedLines.join('\n');
  return { fields: result, cleaned: cleanedText };
}

/**
 * Extracts client name from various sources
 */
function extractClientName(parsed, sheetName, replyContent, emailAddr) {
  try {
    // 1) Check parsed object for likely name keys (case-insensitive)
    if (parsed && typeof parsed === 'object') {
      var nameKeys = ['name', 'full_name', 'full name', 'your_name', 'your name', 'client_name', 'client'];
      var pk = Object.keys(parsed || {});
      for (var i = 0; i < nameKeys.length; i++) {
        var target = nameKeys[i].toLowerCase();
        for (var j = 0; j < pk.length; j++) {
          if ((pk[j] || '').toString().toLowerCase() === target) {
            var val = parsed[pk[j]];
            if (val) return Array.isArray(val) ? val.join(' ').trim() : ('' + val).trim();
          }
        }
      }
    }

    // 2) Use sheet-provided name if it looks valid
    if (sheetName && sheetName.toString().trim() && sheetName.toString().toLowerCase() !== 'unknown') {
      return sheetName.toString().trim();
    }

    // 3) Try to extract name from common signature lines near the end of the reply
    if (replyContent && replyContent.length) {
      // look for 'Regards, John Doe' or 'Thanks, John'
      var sigRe = /(?:Regards|Best|Thanks|Sincerely|Kind regards|Warm regards)\s*,?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/im;
      var m = replyContent.match(sigRe);
      if (m && m[1]) return m[1].trim();

      // look for greeting at top: 'Hi John,' or 'Hello Jane'
      var greetRe = /^(?:\s*)(?:Hi|Hello|Hey|Dear)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})[\s,!\n]/im;
      var mg = replyContent.match(greetRe);
      if (mg && mg[1]) return mg[1].trim();
    }

    // 4) Fallback: use email local-part (before @), transform dots/underscores to spaces and capitalize
    if (emailAddr && emailAddr.indexOf('@') !== -1) {
      var local = emailAddr.split('@')[0].replace(/[._\-]+/g, ' ').trim();
      if (local) {
        var parts = local.split(/\s+/);
        for (var p = 0; p < parts.length; p++) parts[p] = parts[p].charAt(0).toUpperCase() + parts[p].slice(1);
        return parts.join(' ');
      }
    }
  } catch (e) {
    // ignore and fallback
  }
  return '';
}

/**
 * Builds summary from parsed fields when AI is unavailable
 */
function buildSummaryFromParsed(parsed) {
  try {
    if (!parsed || Object.keys(parsed).length === 0) return '';
    var parts = [];
    // Pick a few important keys if present
    var ordered = Object.keys(parsed);
    for (var i = 0; i < ordered.length; i++) {
      var k = ordered[i];
      var v = parsed[k];
      var displayKey = k.replace(/_/g, ' ');
      parts.push(displayKey.charAt(0).toUpperCase() + displayKey.slice(1) + ': ' + (Array.isArray(v) ? v.join(', ') : v));
      if (parts.length >= 5) break; // limit length
    }
    var summary = parts.join('; ');
    return summary.length ? summary : '';
  } catch (e) {
    return '';
  }
}
