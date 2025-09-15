# email-automation

Lightweight repository for scraping/cloning web pages and running simple email/lead automation workflows. Contains small Python utilities and a Google Apps Script for lead handling, plus a `site-ghpages` folder holding a static site snapshot (used for publishing or reference).

## Repository layout

- `scripts/` - Python and Node helper scripts:
  - `clone_webpage.py` — clone a web page to local files (used to populate `site-ghpages`)
  - `transform_for_ghpages.py` — transform cloned pages for GitHub Pages
  - `update_forms_to_formspark.py` — helper to migrate forms to Formspree/Formspark
  - `requirements.txt` — Python dependencies
- `google_apps_scripts/` - Google Apps Script files (organized by functionality):
  - `email-processing/` - Email automation modules:
    - `emailProcessor.gs` — Main email processing and welcome emails
    - `followUpChecker.gs` — Follow-up detection and reminders
    - `aiParser.gs` — AI-powered text parsing and summaries
    - `sheetManager.gs` — Spreadsheet operations for leads
    - `archiveManager.gs` — Lead archiving and cleanup
    - `utils.gs` — Shared utilities and configuration
  - `dashboard/` - Web dashboard modules:
    - `webInterface.gs` — Web app serving and HTML templates
    - `dataService.gs` — Data retrieval and metrics calculation
    - `crudOperations.gs` — Lead CRUD operations
    - `exportService.gs` — Data export functionality
    - `utils.gs` — Dashboard utilities
  - `tests.gs` — Test framework and automated testing
  - `Code.gs` — Legacy monolithic file (deprecated)
  - `dashboard.gs` — Legacy monolithic file (deprecated)
- `site-ghpages/` - Static snapshot of a website (images, CSS, JS and cloned pages)
- `.gitignore` - repository ignore rules (includes `.venv` and `.tmp`)

## Quickstart

These instructions assume macOS/Linux. Windows users can adapt the virtualenv commands.

1) Create and activate a Python virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2) Install Python dependencies

```bash
pip install -r scripts/requirements.txt
```

3) Inspect scripts and run a tool

- Clone a web page (example):

```bash
python3 scripts/clone_webpage.py https://example.com
```

- Transform files for GitHub Pages (adjust paths as needed):

```bash
python3 scripts/transform_for_ghpages.py site-ghpages/ output-ghpages/
```

- Update forms to Formspark/Form handling (read the script header for required env vars):

```bash
python3 scripts/update_forms_to_formspark.py --help
```

4) Apps Script configuration and runtime notes

The Google Apps Scripts have been refactored from monolithic files into modular components for better maintainability:

**Email Processing Modules** (`google_apps_scripts/email-processing/`):
- `emailProcessor.gs` - Main email processing and welcome emails
- `followUpChecker.gs` - Follow-up detection and reminders  
- `aiParser.gs` - AI-powered text parsing and summaries
- `sheetManager.gs` - Spreadsheet operations for leads
- `archiveManager.gs` - Lead archiving and cleanup
- `utils.gs` - Shared utilities and configuration

**Dashboard Modules** (`google_apps_scripts/dashboard/`):
- `webInterface.gs` - Web app serving and HTML templates
- `dataService.gs` - Data retrieval and metrics calculation
- `crudOperations.gs` - Lead CRUD operations
- `exportService.gs` - Data export functionality
- `utils.gs` - Dashboard utilities

**Legacy Files** (deprecated):
- `Code.gs` - Original monolithic email processing script
- `dashboard.gs` - Original monolithic dashboard script

The scripts run inside Google Apps Script (not a local Node process). They read configuration from Script Properties (PropertiesService) and require re-authorization when new scopes are added.

Required Script Properties (set in Apps Script Project Settings → Script properties):
- `CALENDLY_LINK` — public scheduling URL used in welcome emails
- `LEAD_TRACKER_SHEET_ID` — Spreadsheet ID where leads are logged
- `YOUR_EMAIL` — sender / notification email used by the script
- `FOLDER_ID` — Drive folder id containing questionnaire files referenced by the script

Optional Script Properties (for premium features):
- `ENABLE_AI_SUMMARY` — set to 'true' to enable AI-powered executive summaries (premium feature)
- `AI_API_KEY` — Gemini API key (required only when ENABLE_AI_SUMMARY is 'true')

Important: `checkFollowUps()` now uses the Google Calendar API to detect scheduled consultations. To enable that behavior you must:
- In the Apps Script editor enable the Advanced Google Service `Calendar` (Resources → Advanced Google services or Services panel). 
- In the linked Google Cloud project enable the Google Calendar API (Cloud Console → APIs & Services → Library → "Google Calendar API" → Enable).
- Re-authorize the script when prompted. Recommended scope: `https://www.googleapis.com/auth/calendar.events.readonly` (or `.../auth/calendar.events` if you need write access).

Triggers
- Run `setupTriggers()` in the Apps Script editor to create the time-based triggers the project expects. The default setup in the script creates:
  - `processLeadEmails` — every 5 minutes
  - `checkFollowUps` — every hour

Security note: Do not commit production secrets. Use Script Properties or a secure secret manager for credentials.

## Environment variables & secrets

- Scripts may expect API keys or credentials. Common patterns:
  - `FORMSPARK_API_KEY`, `SMTP_USER`, `SMTP_PASS`, etc.
  - For Google Apps Script: `AI_API_KEY` (Gemini API key for premium AI summaries)
- Do not commit secrets. A `.gitignore` is provided to exclude `.env` files, `.venv`, and `.tmp`.
- Google Apps Script properties should be set via Project Settings → Script properties, not environment variables.

## Assumptions & notes

- I couldn't infer exact CLI flags or env var names for each script from the repository snapshot. Before running any script, open the file top comments or run `--help` (if implemented). If a script expects credentials, set them in the environment or a local `.env` (kept out of Git).
- `site-ghpages/` looks like a cloned static site. If you intend to publish it to GitHub Pages, copy the transformed files into a branch called `gh-pages` or use a `gh-pages` deployment action.

Sheet columns & follow-up behavior
- The script logs leads to the `Leads` sheet and writes additional metadata columns used by follow-up detection. Current columns the script writes or expects (left-to-right):
  1. Email
  2. Name
  3. Phone
  4. Preferred Day
  5. Preferred Time
  6. Appointment Types
  7. Message
  8. Timestamp
  9. Followed Up (boolean)
 10. ReminderSentAt (timestamp)
 11. ThreadId (Gmail thread id)
 12. EventId (calendar event id / iCal UID when matched)
 13. MatchMethod (how a follow-up was detected: `calendar-api`, `threadid`, `gmail-search`, `ics-attachment`)
 14. ResponseReceived (boolean - whether a response was received and processed)
 15. ExecutiveSummary (AI-generated summary of lead responses - premium feature)

Note: Columns 14-15 are only created and used when `ENABLE_AI_SUMMARY` is set to 'true'.

Follow-up detection order (what `checkFollowUps()` does):
1. Calendar API search for events on `YOUR_EMAIL` with the lead as an attendee (preferred and most reliable).
2. If available, check the saved `ThreadId` and look for messages after the logged timestamp.
3. Conservative Gmail search for replies from the lead.
4. Scan recent "Invitation" messages for `.ics` attachments and parse for attendee mailto: lines and UID.

When a response is detected:
- The script immediately processes it (no 24-hour wait)
- If AI is enabled (`ENABLE_AI_SUMMARY = 'true'`), generates an executive summary using Gemini AI
- Sends a thank you email to the lead acknowledging their response
- Marks the lead as followed up and records the detection method

The script sends reminder emails only to leads who haven't responded after 24 hours. Leads who respond are processed immediately regardless of timing.

## Premium Features

The script includes optional premium features that can be enabled via script properties:

### AI-Powered Executive Summaries
- **Configuration**: Set `ENABLE_AI_SUMMARY = 'true'` and provide `AI_API_KEY`
- **Functionality**: Automatically generates concise summaries of lead questionnaire responses using Google's Gemini AI
- **Benefits**: Saves time by highlighting key points, concerns, and important details for lawyers
- **Fallback**: When disabled, responses are still processed but marked as "AI Summary disabled"

### Feature Comparison

| Feature | Free Tier | Premium Tier |
|---------|-----------|--------------|
| Welcome emails | ✅ | ✅ |
| Lead tracking | ✅ | ✅ |
| Follow-up detection | ✅ | ✅ |
| Reminder emails | ✅ | ✅ |
| Thank you emails | ✅ | ✅ |
| AI summaries | ❌ | ✅ |
| Response analysis | ❌ | ✅ |

## Contributing

- Add a `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` if you plan to accept external contributions.
- If you add Node dependencies, include a `package.json` and commit a lockfile (or intentionally ignore it and document why).

## Development and Testing

### Google Apps Script Development

This project uses `clasp` (Command Line Apps Script Projects) for local development and deployment:

1. Install clasp globally: `npm install -g @google/clasp`
2. Login: `clasp login`
3. Configure `.clasp.json` with your script ID and project ID
4. Pull existing code: `clasp pull`
5. Push changes: `clasp push`
6. Open in browser: `clasp open`

### Testing

Run automated tests from the Apps Script editor or via clasp:

```javascript
// In Apps Script editor, run:
runAllTests()

// Or test individual modules:
testEmailProcessor()
testDashboard()
```

Manual testing checklist:
- [ ] Email processing works correctly
- [ ] Welcome emails are sent
- [ ] Leads are logged to spreadsheet
- [ ] Follow-up detection functions
- [ ] Dashboard loads and displays data
- [ ] CRUD operations work
- [ ] Export functionality works
- [ ] AI summaries generate (if enabled)

### Best Practices

- **Modular Design**: Keep related functionality in separate modules
- **Configuration**: Use Script Properties for all configuration values
- **Error Handling**: Implement proper try-catch blocks and logging
- **Testing**: Test each module independently before integration
- **Documentation**: Update this README when adding new features
- **Version Control**: Commit frequently and use descriptive commit messages

## License

No license file detected in the repository snapshot. If this is your personal project, consider adding a `LICENSE` file (for example, `MIT`) to clarify reuse rules.
