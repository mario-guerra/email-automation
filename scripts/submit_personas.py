#!/usr/bin/env python3
"""Submit personas from .tmp/sample_answers.md to a Formspark endpoint.

Usage: scripts/submit_personas.py [--all] [--ids 1,2] [--dry-run] [--endpoint URL] [--form 1|3] [--delay 1]

The script parses the markdown file produced earlier and maps fields to the site's form inputs:
- name -> name
- phone -> phone
- email -> email
- preferred_day -> preferred_day
- preferred_time -> preferred_time
- appointment_types[] -> repeated checkbox values
- message -> message (includes short Message plus Questionnaire Responses block)

Hidden/anti-spam fields included by default: _hp (empty), _email (from site), is_submit_1/is_submit_3.
"""

import argparse
import os
import re
import sys
import time
from typing import List, Dict, Any, Tuple

try:
    import requests
except Exception:
    requests = None

DEFAULT_PERSONA_JSON = os.path.join(os.path.dirname(__file__), '..', '.tmp', 'sample_answers.json')
DEFAULT_ENDPOINT = os.environ.get('FORMSPARK_ENDPOINT', 'https://submit-form.com/CYfZeVuMy')
DEFAULT_HIDDEN_EMAIL = 'mario.guerra@gmail.com'


def load_personas(json_path: str) -> List[Dict[str, Any]]:
    # Only support JSON input
    import json
    if not json_path.lower().endswith('.json'):
        raise SystemExit('This tool only accepts JSON input. Provide a .json file via --json')
    if not os.path.exists(json_path):
        raise SystemExit(f'Persona JSON not found at {json_path}')
    obj = json.load(open(json_path, 'r', encoding='utf-8'))
    personas = []
    for item in obj:
        personas.append({
            'id': item.get('id'),
            'name': item.get('name', ''),
            'email': item.get('email', ''),
            'phone': item.get('phone', ''),
            'preferred_day': item.get('preferred_day', ''),
            'preferred_time': item.get('preferred_time', ''),
            'appointment_types': item.get('appointment_types', []) or [],
            'message': item.get('message', '') + (('\n\nQuestionnaire Responses:\n' + item.get('questionnaire_responses', '')) if item.get('questionnaire_responses') else ''),
            'raw': item,
        })

    return personas


def build_payload(persona: Dict[str, Any], form_number: int = 1) -> Tuple[List[Tuple[str, str]], Dict[str, str]]:
    # Return (data_tuples, headers)
    data: List[Tuple[str, str]] = []
    data.append(('name', persona['name']))
    data.append(('phone', persona['phone']))
    data.append(('email', persona['email']))
    data.append(('preferred_day', persona['preferred_day']))
    data.append(('preferred_time', persona['preferred_time']))
    # appointment_types[] repeated
    for at in persona['appointment_types']:
        data.append(('appointment_types[]', at))
    data.append(('message', persona['message']))
    # honeypot should be empty
    data.append(('_hp', ''))
    # include hidden recipient email (mirrors form)
    data.append(('_email', DEFAULT_HIDDEN_EMAIL))
    # include the is_submit_N hidden field
    data.append((f'is_submit_{form_number}', '1'))

    headers = {'User-Agent': 'persona-submitter/1.0'}
    return data, headers


def submit_one(endpoint: str, data: List[Tuple[str, str]], headers: Dict[str, str], dry_run: bool = True) -> Tuple[bool, str]:
    if dry_run:
        return True, f"DRY_RUN payload: {data}"
    if requests is None:
        return False, 'requests package not available'
    try:
        r = requests.post(endpoint, data=data, headers=headers, timeout=15)
        if 200 <= r.status_code < 300:
            return True, f'Status {r.status_code} OK'
        else:
            return False, f'Status {r.status_code}: {r.text[:200]}'
    except Exception as e:
        return False, str(e)


def main(argv: List[str]):
    ap = argparse.ArgumentParser(description='Submit persona test data to Formspark')
    ap.add_argument('json_path', nargs='?', default=DEFAULT_PERSONA_JSON, help='Path to persona JSON file (default ./.tmp/sample_answers.json)')
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument('--all', action='store_true', help='Submit all personas')
    group.add_argument('--ids', help='Comma-separated persona ids to submit, e.g. 1,3,4')
    ap.add_argument('--dry-run', action='store_true', default=False, help='Do not perform network requests; print payloads')
    ap.add_argument('--endpoint', default=DEFAULT_ENDPOINT, help='Formspark endpoint URL')
    ap.add_argument('--form', type=int, choices=(1, 3), default=1, help='Which form number to emulate (is_submit_N)')
    ap.add_argument('--delay', type=float, default=1.0, help='Delay between submissions in seconds')
    opts = ap.parse_args(argv)

    if not os.path.exists(opts.json_path):
        print('Persona JSON not found at', opts.json_path, file=sys.stderr)
        sys.exit(2)

    personas = load_personas(opts.json_path)
    if not personas:
        print('No personas found in', opts.md, file=sys.stderr)
        sys.exit(2)

    # Build selection
    selected = []
    if opts.all:
        selected = personas
    else:
        wanted = set()
        for part in opts.ids.split(','):
            part = part.strip()
            if not part:
                continue
            try:
                wanted.add(int(part))
            except Exception:
                pass
        selected = [p for p in personas if p['id'] in wanted]

    if not selected:
        print('No matching personas selected', file=sys.stderr)
        sys.exit(1)

    print(f'Preparing to submit {len(selected)} persona(s) to {opts.endpoint} (form {opts.form})')

    any_fail = False
    for p in selected:
        data, headers = build_payload(p, form_number=opts.form)
        ok, msg = submit_one(opts.endpoint, data, headers, dry_run=opts.dry_run)
        tag = f"Persona {p.get('id')}: {p.get('name')!s}"
        if ok:
            print(f'[OK] {tag} -> {msg}')
        else:
            any_fail = True
            print(f'[FAIL] {tag} -> {msg}', file=sys.stderr)
        if not opts.dry_run:
            time.sleep(opts.delay)

    if any_fail:
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
