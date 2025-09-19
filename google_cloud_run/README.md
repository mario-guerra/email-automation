Cloud Run proxy — README

Purpose
- Minimal Cloud Run proxy to front an Apps Script webapp so the dashboard appears under a custom domain.
- Demo/MVP: host-based mapping (in-memory). Replace with Firestore/Secret Manager for production.

Prerequisites
- gcloud CLI installed and authenticated: `gcloud auth login`
- Billing enabled on your GCP project
- Domain you control (for domain-mapping)
- Verify domain in Google Search Console for the GCP project if you plan to map a custom domain

Files
- index.js — Express proxy
- package.json — Node dependencies
- .gcloudignore — files to ignore when deploying
- env.example — placeholder variables

Deploy (from source, no manual Dockerfile)
1. Fill env.example or set env vars when deploying.
2. Enable APIs:
```bash
# bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com domainmapping.googleapis.com
```

3. Deploy from source (builds image via Cloud Build):
```bash
# bash
gcloud run deploy email-proxy \
  --project=PROJECT_ID \
  --region=REGION \
  --source=. \
  --allow-unauthenticated \
  --set-env-vars=APPS_SCRIPT_URL="https://script.google.com/macros/s/REPLACE_WITH_ID/exec"
```

Map custom domain (requires domain verification)
```bash
# bash
gcloud run domain-mappings create --service=email-proxy --domain=dashboard.example.com --region=REGION --project=PROJECT_ID
```
Follow DNS instructions printed by gcloud and wait for managed certificate provisioning.

Local testing
- Install deps and run locally:
```bash
# bash
npm ci
node index.js
```
- Test with Host header:
```bash
# bash
curl -H "Host: dashboard.example.com" "http://localhost:8080/?api=status"
curl -H "Host: dashboard.example.com" "http://localhost:8080/"
```

Endpoints
- GET /health — quick health check for load balancer
- GET /status — upstream probe for mapped tenant (returns upstream status)
- All other paths are proxied to the Apps Script target defined for the Host header.

Notes & next steps
- Replace in-memory TENANTS map with Firestore-backed tenant config and Secret Manager for per-tenant secrets.
- Add auth (Firebase Auth or API keys) and per-tenant rate limiting for production.
- Consider HTTPS Load Balancer + Cloud Armor if you require WAF, reserved IP, or advanced routing.
