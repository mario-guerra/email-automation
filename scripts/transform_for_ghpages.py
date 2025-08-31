#!/usr/bin/env python3
"""
Transform cloned homepage into site-ghpages-ready static homepage.

Actions:
- Backup site-ghpages/index.html -> site-ghpages/index.html.bak
- Remove reCAPTCHA scripts/elements and g-recaptcha-response textareas/inputs
- Convert Gravity Forms (id starting with gform_) to static POST to Formspark placeholder
- Remove GF AJAX iframes and GF hidden inputs
- Add a simple honeypot input named _hp
- Insert admin-ajax neutralizer JS after jquery script tag (or in head if not found)
- Create .github/workflows/gh-pages.yml and site-ghpages/README.md
"""
import os
import re
import shutil
from bs4 import BeautifulSoup

SRC = "site-ghpages/index.html"
BACKUP = "site-ghpages/index.html.bak"
FORMSPARK_PLACEHOLDER = "https://submit-form.com/YOUR_FORMSPARK_FORM_ID"

if not os.path.exists(SRC):
    print("Error: source file not found:", SRC)
    raise SystemExit(1)

# Backup
shutil.copy2(SRC, BACKUP)
print("Backup created:", BACKUP)

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

# 1) Remove reCAPTCHA-related script tags and grecaptcha badge elements
for script in list(soup.find_all("script")):
    src = script.get("src") or ""
    txt = (script.string or "") + ""
    if "recaptcha" in src.lower() or "grecaptcha" in txt or "grecaptcha" in src.lower() or "g-recaptcha" in txt:
        script.decompose()

# Remove grecaptcha badge elements (by class or id)
for badge in list(soup.find_all(class_=re.compile(r"grecaptcha|g-recaptcha", re.I))):
    badge.decompose()

# Remove textarea or input with name 'g-recaptcha-response' (v2/v3)
for element in list(soup.find_all(lambda tag: (tag.name in ("textarea","input")) and tag.get("name","").lower()=="g-recaptcha-response")):
    element.decompose()

# 2) Remove Gravity Forms AJAX iframes (id like gform_ajax_frame_*)
for iframe in list(soup.find_all("iframe", id=re.compile(r"^gform_ajax_frame_", re.I))):
    iframe.decompose()

# 3) Transform Gravity Forms to static POSTs to Formspark placeholder
gf_hidden_names = {
    "gform_ajax", "is_submit", "gform_submit", "gform_unique_id", "state",
    "gform_target_page_number", "gform_source_page_number", "gform_field_values"
}

forms = soup.find_all("form", id=re.compile(r"^gform_\d+", re.I))
for form in forms:
    # Set action and method
    form["action"] = FORMSPARK_PLACEHOLDER
    form["method"] = "POST"
    # Remove target (was used for iframe postback)
    if "target" in form.attrs:
        del form.attrs["target"]

    # Remove GF hidden inputs
    for inp in list(form.find_all("input", {"type": "hidden"})):
        name = inp.get("name","")
        if name in gf_hidden_names or name.startswith("gform_") or name.startswith("g-recaptcha"):
            inp.decompose()

    # Remove inputs/textarea with name 'g-recaptcha-response' just in case
    for element in list(form.find_all(lambda tag: (tag.name in ("textarea","input")) and tag.get("name","").lower()=="g-recaptcha-response")):
        element.decompose()

    # Add simple honeypot field if not present
        if not form.find("input", {"name":"_hp"}):
            # Create honeypot input safely (avoid passing 'name' as a keyword to new_tag)
            hp = soup.new_tag("input")
            hp["type"] = "text"
            hp["name"] = "_hp"
            hp["id"] = "_hp"
            hp.attrs["style"] = "display:none!important"
            hp.attrs["tabindex"] = "-1"
            hp.attrs["autocomplete"] = "off"
            # Insert as first child of form
            if form.contents:
                form.insert(0, hp)
            else:
                form.append(hp)

# 4) Remove inline scripts that are GF ajax postback handlers or spinner initializers
inline_keywords = [
    "gform_ajax", "GF_AJAX_POSTBACK", "gformInitSpinner", "gform_",
    "gform_submit", "gform_target_page_number", "gform_source_page_number"
]
for script in list(soup.find_all("script")):
    if script.string:
        txt = script.string
        if any(k in txt for k in inline_keywords):
            script.decompose()

# 5) Insert admin-ajax neutralizer JS after jquery-core-js or jquery script
neutralizer_js = r"""
<script>
(function(){
  // Neutralize WP admin-ajax calls and sanitize localized ajax URLs
  try {
    window.pbLocalizeObj = window.pbLocalizeObj || {};
    window.PremiumSettings = window.PremiumSettings || {};
    window.eae = window.eae || {};
    window.uael_script = window.uael_script || {};
    window.elementorFrontendConfig = window.elementorFrontendConfig || window.elementorFrontendConfig || {};
    function sanitize(obj, key){
      try {
        if(obj && obj[key]) obj[key] = (""+obj[key]).replace(/^https?:\/\/[^\/]+/,'');
      } catch(e){}
    }
    sanitize(window.pbLocalizeObj, "ajax");
    sanitize(window.PremiumSettings, "ajaxurl");
    if(window.eae) sanitize(window.eae, "ajaxurl");
    if(window.uael_script) sanitize(window.uael_script, "ajax_url");
    if(window.elementorFrontendConfig && window.elementorFrontendConfig.urls) sanitize(window.elementorFrontendConfig.urls, "ajaxurl");
  } catch(e){}

  function overrideAjax(){
    if(!window.jQuery || !jQuery.ajax) return;
    var _ajax = jQuery.ajax;
    jQuery.ajax = function(opts){
      var url = (typeof opts === "string") ? opts : (opts && opts.url) || "";
      if(url && url.indexOf("admin-ajax.php") !== -1){
        var d = jQuery.Deferred();
        d.resolve({});
        if (typeof opts === "object" && typeof opts.success === "function") {
          try { opts.success({}); } catch(e){}
        }
        return d.promise();
      }
      return _ajax.apply(this, arguments);
    };
  }

  if(window.jQuery) overrideAjax();
  else document.addEventListener("DOMContentLoaded", overrideAjax, {once:true});
})();
</script>
"""

inserted = False
# prefer script with id jquery-core-js
jq_tag = soup.find("script", id="jquery-core-js")
if not jq_tag:
    # fallback: find script with src containing 'jquery' and 'min.js'
    jq_tag = soup.find("script", src=re.compile(r"jquery.*\.js", re.I))
if jq_tag:
    new_soup_fragment = BeautifulSoup(neutralizer_js, "html.parser")
    jq_tag.insert_after(new_soup_fragment)
    inserted = True

if not inserted:
    # fallback: put in head
    head = soup.head or soup
    new_soup_fragment = BeautifulSoup(neutralizer_js, "html.parser")
    head.append(new_soup_fragment)

# Write updated HTML
with open(SRC, "w", encoding="utf-8") as f:
    f.write(str(soup))

print("Transformed:", SRC)

# 6) Create GitHub Actions workflow file
workflow_dir = ".github/workflows"
os.makedirs(workflow_dir, exist_ok=True)
workflow_path = os.path.join(workflow_dir, "gh-pages.yml")
workflow_content = """name: Deploy site to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site-ghpages
"""
with open(workflow_path, "w", encoding="utf-8") as f:
    f.write(workflow_content)
print("Created workflow:", workflow_path)

# 7) Create site-ghpages/README.md
readme_path = "site-ghpages/README.md"
readme_content = """Static homepage prepared for GitHub Pages.

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
"""
with open(readme_path, "w", encoding="utf-8") as f:
    f.write(readme_content)
print("Created README:", readme_path)

print("Done.")
