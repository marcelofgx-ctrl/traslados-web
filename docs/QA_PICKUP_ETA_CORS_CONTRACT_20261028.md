# Quick Trip — QA pickup-eta CORS and contracts

**Scope and base:** isolated branch of marcelofgx-ctrl/traslados-web from main@4f33886230ae39fcb9fb06b18c92564d473d9d75. Only versioned Edge code, local mock tests and this QA document were changed. No Supabase, Cloudflare, Vercel, Android, passenger UI, SQL migration or production deployment.

## Existing defects in source (deployment state NOT verified)

- Two versioned implementations of pickup-eta diverged: operativa/edge-functions/pickup-eta required a session, while supabase/functions/pickup-eta had a guest path.
- Neither version listed the current Vercel QA preview as an allowed Origin. Browsers surface forbidden preflight responses without CORS headers as network errors.
- SQL in operativa/migrations/20261010042000_anonymous_pickup_eta_coarse_v1.sql returns coarseDriverLat / coarseDriverLng for guests. The prior guest Edge version expected serviceDriverLat / serviceDriverLng.
- Passenger v77 diagnostics show availability:available but pickup ETA network_error for guest and session; the diagnosis is compatible with the CORS discrepancy but live Supabase Edge code was not inspected or changed.

## Contract implemented in QA only

- Byte-identical source in both pickup-eta directories. Preserves guest and authenticated-session branches.
- Exact allowed origins: https://marcelofgx-ctrl.github.io, https://traslados-web.marcelof-gx.workers.dev, and https://quicktrip-live-qa-only-20261027-59j1a946w-marcelofgx-1927.vercel.app.
- No wildcard *.vercel.app: later previews must be authorized individually. Preflight responds with Origin, Vary, POST/OPTIONS, apikey, authorization, content-type and x-client-info.
- Guest access still requires the approved Origin and SQL service-only gate driver_pickup_public_context_v1 with its consent, rate limits, coarsening and schedule protection. Uses exclusively coarseDriverLat and coarseDriverLng; fails closed if absent.
- Customer session uses driver_pickup_eta_context_v1, with existing custom session-token gate. Exact GPS only passes from SQL to the trusted road service, never in the passenger response. No imitation route; still requires a verified OpenRouteService or verified ROAD cache.
- No credentials are saved in source or test artifacts. No changes to verify_jwt configuration or real backend.

## QA evidence / limits

The isolated workflow runs Bun tests for both versioned implementations, existing privacy regressions, positive/negative preflight, guest/session, unauthorized Origin, missing keys, rate limits, schema result field mapping, provider errors and no GPS leakage. All outgoing calls are intercepted by local mocks; it does not query live Supabase or send real reservations.

A green result is **code QA only**, not proof of the deployed Edge runtime, deployed SQL, JWT setting, Samsung ETA or current GPS publication. Live deployment requires separate explicit approval and then real CORS + Samsung verification without exposing vehicle coordinates.
