# Implementation Plan

## Overview

This plan fixes the geocoding endpoint bug using the exploratory bugfix methodology: first confirm the bug (wrong endpoint URL) on the unfixed code, record the surrounding behavior that must be preserved, apply a single-line URL correction in `geocode`, then verify the fix and confirm no regressions. Per project steering, validation is inspection/manual-smoke based with `node --check app.js` as the only automated check.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "description": "Run on the UNFIXED code: confirm the bug condition and record the preservation baseline. Independent of each other."
    },
    {
      "wave": 2,
      "tasks": ["3.1"],
      "description": "Apply the single-line URL fix in geocode. Depends on tasks 1 and 2."
    },
    {
      "wave": 3,
      "tasks": ["3.2", "3.3"],
      "description": "Verify the bug condition check now passes and preservation behaviors are unchanged. Depends on 3.1."
    },
    {
      "wave": 4,
      "tasks": ["4"],
      "description": "Checkpoint - ensure all checks pass. Depends on 3.2 and 3.3."
    }
  ]
}
```

- Task 1 and Task 2 are independent and both run on the UNFIXED code before any change.
- Task 3.1 (the fix) depends on Tasks 1 and 2.
- Tasks 3.2 and 3.3 depend on 3.1.
- Task 4 depends on 3.2 and 3.3 completing.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Geocoding Targets the Correct Nominatim Endpoint
  - **CRITICAL**: This check MUST demonstrate the bug on the UNFIXED code - the failing observation confirms the bug exists
  - **DO NOT attempt to fix the code when the bug is confirmed in this step**
  - **NOTE**: This check encodes the expected behavior - it will validate the fix once the URL is corrected
  - **GOAL**: Surface the counterexample that demonstrates the bug exists (wrong endpoint URL)
  - **Scoped Approach**: The bug condition holds for every city (`isBugCondition` returns true for any geocoding request), so scope to concrete representative cities: "Seattle", "New York", "Nonexistentville"
  - Inspect the URL that `geocode(city, signal)` constructs on the UNFIXED code (Bug Condition in design): confirm it contains `geocoding.geo.census.gov` and `/invalid`
  - The expected (post-fix) assertion is that the URL starts with `https://nominatim.openstreetmap.org/search` and contains `q=<encodeURIComponent(city)>`, `format=json`, `limit=1`, and does NOT contain `geocoding.geo.census.gov` or `/invalid` (Expected Behavior / Property 1 in design)
  - Optionally run the app on `localhost:8080` and submit "Seattle" / "New York", observing the "Location lookup failed" error plus the non-OK/network/CORS failure for the Census endpoint; confirm the unknown city "Nonexistentville" also shows "Location lookup failed" instead of "City not found"
  - Run `node --check app.js` to confirm the JavaScript is valid before changes (per project steering, this is the only automated check)
  - **EXPECTED OUTCOME**: The bug is confirmed - the constructed URL points at the wrong endpoint and every city fails (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "URL = `https://geocoding.geo.census.gov/geocoder/locations/invalid?q=Seattle&format=json&limit=1`; 'Seattle' shows 'Location lookup failed'")
  - Mark task complete when the counterexample is observed and documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Everything Except the Geocoding URL Is Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Because the bug condition holds for every geocode call (¬isBugCondition is empty for the URL itself), preservation is scoped to the surrounding behavior the fix must NOT touch (Preservation Requirements in design)
  - Observe on the UNFIXED code and record baseline behavior:
    - Validation (`validateCity`): empty, whitespace-only, and over-100-character inputs show their existing messages without entering the in-progress state
    - Request mechanics: genuine geocoding failures show "Location lookup failed" and retain the entered city text; the descriptive `User-Agent` header, 10-second `AbortController` timeout, and caller-provided abort signal behave as before
    - Forecast + rendering: after a successful geocode, the two-step NWS lookup (`getForecast`) and the current-conditions + 5-day table rendering behave unchanged
    - Unit toggle (`onToggleUnit`): toggling °F/°C re-renders the last successful result with no new network request
  - Capture these observed behaviors as the preservation baseline; verify the planned change is a single-line `const url` edit inside `geocode` (a narrow diff is the preservation guarantee for this project)
  - Run `node --check app.js` on the UNFIXED code and confirm it passes
  - **EXPECTED OUTCOME**: Baseline behavior is observed and recorded (confirms what must be preserved after the fix)
  - Mark task complete when preservation behaviors are observed and documented on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for geocoding endpoint (call Nominatim instead of the Census `/invalid` endpoint)

  - [x] 3.1 Implement the fix
    - In `geocode(city, signal)` in `app.js`, replace the `const url = ...` expression that targets `https://geocoding.geo.census.gov/geocoder/locations/invalid?q=...` with the Nominatim search endpoint: `const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(city) + '&format=json&limit=1';`
    - Preserve `encodeURIComponent(city)` - pass the user-entered city straight through (no hardcoding/storing of city names, per steering)
    - Leave all request options untouched: the `AbortController`, 10-second `setTimeout`, caller-`signal` combination, `Accept` and `User-Agent` headers, `.then` status check, `response.json()`, `pickCoordinates(results)` mapping, and `.finally` cleanup
    - Change no other files or functions (`index.html`, pure helpers, DOM writers, `getForecast`, `onSubmit`, `onToggleUnit` stay as-is); introduce no classes, interfaces, caching, dependencies, or build steps
    - _Bug_Condition: isBugCondition(input) returns true for any geocoding request (wrong endpoint URL regardless of city)_
    - _Expected_Behavior: geocode builds and calls `https://nominatim.openstreetmap.org/search?q=<encodeURIComponent(city)>&format=json&limit=1` (Property 1 in design)_
    - _Preservation: validateCity, pickCoordinates, getForecast, renderers, unit toggle, and geocode's timeout/abort/User-Agent handling unchanged (Preservation Requirements in design)_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Geocoding Targets the Correct Nominatim Endpoint
    - **IMPORTANT**: Re-run the SAME check from task 1 - do NOT write a new one
    - Inspect the URL `geocode` now constructs: confirm it starts with `https://nominatim.openstreetmap.org/search`, contains `q=<encodeURIComponent(city)>`, `format=json`, `limit=1`, and does NOT contain `geocoding.geo.census.gov` or `/invalid`
    - Optionally run the app on `localhost:8080`: submitting "Seattle" / "New York" resolves to coordinates and renders a forecast; submitting the unknown "Nonexistentville" shows "City not found" (the not-found path), not "Location lookup failed"
    - **EXPECTED OUTCOME**: The check now passes (confirms the bug is fixed and valid US cities resolve)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Everything Except the Geocoding URL Is Unchanged
    - **IMPORTANT**: Re-run the SAME observations from task 2 - do NOT write new ones
    - Confirm the diff touches only the single `const url` line inside `geocode` and no other function or request option changed
    - Confirm validation messages, the NWS forecast lookup and rendering, the unit toggle (no new request), and genuine-failure messaging / `User-Agent` / timeout / abort-signal handling all behave as recorded on the unfixed code
    - Run `node --check app.js` and confirm it passes
    - **EXPECTED OUTCOME**: Preservation behaviors are unchanged (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all checks pass
  - Confirm the bug condition check (task 3.2) passes and the preservation checks (task 3.3) still hold
  - Confirm `node --check app.js` passes
  - Ensure all checks pass; ask the user if questions arise

## Notes

- The bug condition (`isBugCondition`) holds for every geocoding request because the endpoint URL is wrong regardless of the city value; ¬isBugCondition is effectively empty for the URL itself, so preservation is scoped to the surrounding behavior the fix must not touch.
- The fix is intentionally a single-line change to the `const url` expression inside `geocode(city, signal)` — a narrow diff is the strongest practical preservation guarantee for this project.
- This project uses minimal tooling (no property-based test framework). The Property 1 (Fix Checking) and Property 2 (Preservation Checking) specifications from the design are verified by URL inspection, scoped-diff review, and manual browser smoke tests rather than a generator-based framework.
- City names are never hardcoded or stored; the user-entered city is passed straight through `encodeURIComponent`.
