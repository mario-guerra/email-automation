# email-automation

Lightweight repository for scraping/cloning web pages and running simple email/lead automation workflows. Contains small Python utilities and a Node.js script plus a `site-ghpages` folder holding a static site snapshot (likely used for hosting or reference).

## Repository layout

- `scripts/` - Python and Node helper scripts:
  - `clone_webpage.py` — clone a web page to local files (used to populate `site-ghpages`)
  - `lead_automation.js` — Node script for lead/email automation
  - `transform_for_ghpages.py` — transform cloned pages for GitHub Pages
  - `update_forms_to_formspark.py` — helper to migrate forms to Formspree/Formspark
  - `requirements.txt` — Python dependencies
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

4) Node/JavaScript script

Apps Script (production) configuration

This repo's `lead_automation.js` is intended to run inside Google Apps Script. It reads all configuration from **Script Properties** (PropertiesService). No local Node.js runtime or `.env` files are required.

1. In the Apps Script editor open Project Settings → Script properties and add the following keys:
  - `CALENDLY_LINK`
  - `LEAD_TRACKER_SHEET_ID`
  - `YOUR_EMAIL`
  - `FOLDER_ID`

2. Deploy the Apps Script and set up triggers as needed. The script will fail with a clear error if any required Script Property is missing.

Security note: Do not commit production secrets to source control. Store credentials in Apps Script Script Properties or a secure secret manager.

## Environment variables & secrets

- Scripts may expect API keys or credentials. Common patterns:
  - `FORMSPARK_API_KEY`, `SMTP_USER`, `SMTP_PASS`, etc.
- Do not commit secrets. A `.gitignore` is provided to exclude `.env` files, `.venv`, and `.tmp`.

## Assumptions & notes

- I couldn't infer exact CLI flags or env var names for each script from the repository snapshot. Before running any script, open the file top comments or run `--help` (if implemented). If a script expects credentials, set them in the environment or a local `.env` (kept out of Git).
- `site-ghpages/` looks like a cloned static site. If you intend to publish it to GitHub Pages, copy the transformed files into a branch called `gh-pages` or use a `gh-pages` deployment action.

## Contributing

- Add a `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` if you plan to accept external contributions.
- If you add Node dependencies, include a `package.json` and commit a lockfile (or intentionally ignore it and document why).

## Recommended follow-ups

- Add short README headers at the top of each script describing usage and required env vars.
- Add `package.json` if `lead_automation.js` needs npm packages.
- Add minimal automated tests for the Python utilities (pytest) and a GitHub Actions workflow to run them.

## License

No license file detected in the repository snapshot. If this is your personal project, consider adding a `LICENSE` file (for example, `MIT`) to clarify reuse rules.

---

If you want, I can:
- open each script and extract/auto-generate a short usage section from its docstring/header;
- add a `package.json` skeleton for `lead_automation.js` if you tell me which npm packages it requires; or
- create a `CONTRIBUTING.md` and `LICENSE` (MIT) file.

Please tell me which follow-up you'd like next.
