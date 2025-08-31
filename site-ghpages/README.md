Static homepage prepared for GitHub Pages.

Important manual steps:
- Replace Formspark placeholder(s) in index.html:
  - Search for "submit-form.com/YOUR_FORMSPARK_FORM_ID" and replace with your Formspark form ID.
- Test locally:
  - python3 -m http.server 8000 --directory site-ghpages
  - Open http://localhost:8000
- Deployment:
  - Push to your repository's main branch. The GitHub Action will publish ./site-ghpages to GitHub Pages.

Notes:
- reCAPTCHA elements removed (per request). A simple honeypot input named `_hp` was added for spam mitigation.
- Plugin admin-ajax calls are neutralized by a small JS stub; dynamic plugin features requiring server responses will not work.
