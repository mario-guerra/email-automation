#!/usr/bin/env python3
"""
Update existing forms in site-ghpages/index.html to submit to Formspark.

Behavior:
- Backup site-ghpages/index.html -> site-ghpages/index.html.bak2
- For each <form> that:
  - has id starting with "gform_" OR
  - has class containing "gform" OR
  - has action containing "admin-ajax.php" OR
  - has no action or action="#" :
    - set action to FORMSPARK_PLACEHOLDER
    - set method="POST"
    - remove target attribute
    - keep existing input names
    - add honeypot input named "_hp" if missing
    - remove any inputs/textareas named "g-recaptcha-response"
- Remove iframe elements with id starting with gform_ajax_frame_
- Remove <script> tags referencing recaptcha/grecaptcha
- Write modified HTML back to site-ghpages/index.html and print a summary.
"""
import os
import shutil
import re
from bs4 import BeautifulSoup

SRC = "site-ghpages/index.html"
BACKUP = "site-ghpages/index.html.bak2"
FORMSPARK_PLACEHOLDER = "https://submit-form.com/YOUR_FORMSPARK_FORM_ID"

if not os.path.exists(SRC):
    print("Source file not found:", SRC)
    raise SystemExit(1)

shutil.copy2(SRC, BACKUP)
print("Backup created:", BACKUP)

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

def is_target_form(form):
    # id starting with gform_
    fid = form.get("id","")
    classes = " ".join(form.get("class") or [])
    action = form.get("action","").strip()
    if re.match(r"^gform_\d+", fid, re.I): 
        return True
    if "gform" in classes.lower():
        return True
    if action == "" or action == "#" or "admin-ajax.php" in action:
        return True
    return False

modified = 0
for form in soup.find_all("form"):
    if not is_target_form(form):
        continue
    # set action and method
    form["action"] = FORMSPARK_PLACEHOLDER
    form["method"] = "POST"
    if "target" in form.attrs:
        del form.attrs["target"]
    # remove g-recaptcha-response inputs/textarea inside the form
    for el in list(form.find_all(lambda tag: tag.name in ("input","textarea") and tag.get("name","").lower()=="g-recaptcha-response")):
        el.decompose()
    # ensure honeypot _hp exists
    if not form.find("input", {"name":"_hp"}):
        hp = soup.new_tag("input")
        hp["type"] = "text"
        hp["name"] = "_hp"
        hp["id"] = "_hp"
        hp["style"] = "display:none!important"
        hp["tabindex"] = "-1"
        hp["autocomplete"] = "off"
        form.insert(0, hp)
    modified += 1

# remove GF AJAX iframes
iframes_removed = 0
for iframe in list(soup.find_all("iframe", id=re.compile(r"^gform_ajax_frame_", re.I))):
    iframe.decompose()
    iframes_removed += 1

# remove recaptcha/grecaptcha script tags (src or inline text)
scripts_removed = 0
for script in list(soup.find_all("script")):
    src = script.get("src") or ""
    txt = (script.string or "") or ""
    if "recaptcha" in src.lower() or "grecaptcha" in src.lower() or "g-recaptcha" in txt or "grecaptcha" in txt:
        script.decompose()
        scripts_removed += 1

with open(SRC, "w", encoding="utf-8") as f:
    f.write(str(soup))

print("Forms modified:", modified)
print("GF AJAX iframes removed:", iframes_removed)
print("Recaptcha scripts removed:", scripts_removed)
print("Wrote:", SRC)
