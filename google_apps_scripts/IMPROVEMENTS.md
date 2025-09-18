# Improvements & Simplification Suggestions

This document captures concise, actionable recommendations to simplify, harden, and operationalize the email-automation Apps Script project. Each item includes a short rationale and the suggested next step.

## 1) Centralize configuration
- Rationale: Hard-coded IDs and scattered property access make deployments error-prone.
- Recommendation: Add `getConfig()` wrapper and move all hard-coded sheet/folder IDs into Script Properties.
- Next step: Implement `config.js` helper + update callers to use `getConfig('LEAD_TRACKER_SHEET_ID')`.

## 2) Persistence service
- Rationale: `sheetManager` + `archiveManager` have overlapping responsibilities.
- Recommendation: Merge into a single `persistence` module with clear methods: `upsertLead`, `getLeadByEmail`, `archiveLeadsOlderThan`.
- Next step: Create `persistence.gs` and refactor callers incrementally.

## 3) Separate parsing from I/O
- Rationale: Easier to unit test and to reuse parsing logic.
- Recommendation: Keep `aiParser` and regex parsers pure (no Drive/Gmail/Sheet calls); call them from processing layer.
- Next step: Extract side-effect free parsing functions to `parsers.gs`.

## 4) Batch writes & minimize API calls
- Rationale: Apps Script quotas and slow per-row writes cause failures.
- Recommendation: Use batched `Range.setValues` for bulk updates and minimize calls inside loops.
- Next step: Identify hotspots (sheet loops) and refactor.

## 5) Improve reliability & observability
- Rationale: Hard to debug failures and track runtime health.
- Recommendation:
  - Add structured logs and an alerting rule (Cloud Logging or email).
  - Add retry with exponential backoff for external calls (UrlFetchApp, Drive, Calendar, Gmail).
  - Add a simple "healthCheck" endpoint that reports last run times and last successful operations.
- Next step: Create `observability.md` and add a basic health-check function.

## 6) Harden AI usage
- Rationale: Cost and availability concerns.
- Recommendation:
  - Centralize AI client with rate-limiting, caching, and deterministic fallbacks.
  - Validate/normalize AI outputs before persisting.
- Next step: Implement `aiClient.gs` wrapper and a small cache (ScriptProperties or Drive cache).

## 7) Security & access
- Rationale: Current webapp is public; secrets stored in Script Properties.
- Recommendation:
  - Use Secret Manager (or encrypted properties) for API keys.
  - Limit webapp access to authenticated users if possible, or add verification + CAPTCHAs.
- Next step: Document policy changes in `SECURITY.md`.

## 8) Tests & CI
- Rationale: No automated GAS CI; tests rely on manual runs.
- Recommendation:
  - Add GitHub Actions workflow using `clasp` to run lint, push to a staging project, and run a smoke test against a staging deploy URL.
  - Add mocks for AI/Gmail/Drive in unit tests; keep integration tests separate.
- Next step: Draft `ci/gas-clasp.yml` (GH Action) and a small mock framework.

## 9) Triggers bootstrap script
- Rationale: Manual trigger setup is error-prone during handoff.
- Recommendation: Provide `bootstrapTriggers()` script that creates recommended time-based triggers when run by an owner with appropriate permissions.
- Next step: Add `bootstrapTriggers.gs` and document ownership expectations.

## Prioritization (short)
- P0 (High): Centralize config, batch writes, persistence service, tests/CI.
- P1 (Medium): Observability, AI client/wrapping, triggers bootstrap.
- P2 (Low): Secret Manager migration, UI access lockdown (depends on policy).

---

If you want, I can:
- Implement the `getConfig()` helper and replace one hard-coded ID as a proof-of-concept.
- Create `persistence.gs` scaffold and migrate one small function.
- Add a GitHub Actions `clasp` workflow scaffold.

Tell me which one to implement next and I will proceed.
