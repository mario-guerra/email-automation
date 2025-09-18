#!/usr/bin/env bash
# Simple test runner for the Apps Script doPost endpoint
# Usage: ./run_apps_script_tests.sh <DEPLOY_URL>
# Example: ./run_apps_script_tests.sh "https://script.google.com/macros/s/XXX/exec"

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <DEPLOY_URL>"
  exit 2
fi

DEPLOY_URL="$1"

echo "Testing Apps Script endpoint: $DEPLOY_URL"

echo
echo "1) JSON POST (appointment_types as array)"
curl -sS -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$DEPLOY_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Curl JSON User",
    "email": "test-recipient@example.com",
    "phone": "512-555-0000",
    "preferred_day": "Wednesday",
    "preferred_time": "Afternoon",
    "appointment_types": ["Estate Planning","Probate"],
    "message": "This is a test submission via JSON."
  }'

echo
echo "2) JSON POST (appointmentTypes as string)"
curl -sS -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$DEPLOY_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Curl JSON User 2",
    "email": "test-recipient@example.com",
    "appointmentTypes": "Traffic/Criminal",
    "message": "Test submission with appointmentTypes string."
  }'

echo
echo "3) Form-encoded POST (typical browser form)"
curl -sS -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$DEPLOY_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "name=Form User" \
  --data-urlencode "email=test-recipient@example.com" \
  --data-urlencode "phone=512-555-1111" \
  --data-urlencode "preferred_day=Tuesday" \
  --data-urlencode "preferred_time=Morning" \
  --data-urlencode "appointment_types=Estate Planning, Probate" \
  --data-urlencode "message=This is a test form-encoded submission."

echo
echo "Done. Check recipient inbox and Leads sheet."
