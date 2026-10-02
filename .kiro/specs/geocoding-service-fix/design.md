# Geocoding Service Fix Bugfix Design

## Overview

Every city search in the weather app currently fails. The `geocode(city, signal)` I/O function in `app.js` builds its request URL against the wrong service — the US Census geocoder — with an obviously invalid `/invalid` path segment:

```
https://geocoding.geo.census.gov/geocoder/locations/invalid?q=<city>&format=json&limit=1
```

Because this endpoint is wrong (and triggers a non-OK status / network / CORS failure), every geocode call rejects, and `onSubmit` routes every city to the "Location lookup failed" error. No forecast is ever retrieved.

The fix is targeted and minimal: change only the URL `geocode` builds so it calls the correct Nominatim search endpoint the app is designed for:

```
https://nominatim.openstreetmap.org/search?q=<city>&format=json&limit=1
```

The downstream response handling (`pickCoordinates` reading `results[0].lat` / `results[0].lon`) already matches Nominatim's response shape, so no other code changes. Everything else — validation, the two-step NWS forecast lookup, rendering, the unit toggle, and `geocode`'s 10-second `AbortController` timeout, descriptive `User-Agent`, and caller-provided abort-signal handling — must remain exactly as it is. This design follows project steering: plain HTML + vanilla JS, no frameworks/build/classes/caching, pure logic kept separate from I/O and DOM, and minimal testing (`node --check app.js`).

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a geocoding request is issued for any submitted city. Because the endpoint URL is wrong regardless of the city value, the condition holds for every geocode call.
- **Property (P)**: The desired behavior — `geocode` builds and calls the correct Nominatim search endpoint so a valid US city resolves to coordinates via `pickCoordinates`.
- **Preservation**: All surrounding behavior the fix must NOT touch — validation, forecast lookup, rendering, unit toggle, and `geocode`'s timeout/abort/`User-Agent` handling must behave identically before and after the fix.
- **F**: The original `geocode(city, signal)` function (builds the Census `/invalid` URL).
- **F'**: The fixed `geocode(city, signal)` function (builds the Nominatim URL).
- **geocode(city, signal)**: The I/O function in `app.js` that fetches coordinates for a city. It owns the URL being corrected.
- **pickCoordinates(results)**: The pure helper in `app.js` that reads `results[0].lat` / `results[0].lon` from the geocoder response. Already matches Nominatim's shape; unchanged.
- **buildGeocodeUrl (conceptual)**: The URL-construction expression inside `geocode`. The single line being changed.

## Bug Details

### Bug Condition

The bug manifests on every city search. The `geocode` function constructs its request URL against the US Census geocoder (`https://geocoding.geo.census.gov/geocoder/locations/invalid`) with an invalid `/invalid` path segment instead of the Nominatim search endpoint. The request fails with a non-OK HTTP status or a network/CORS error before coordinates can be resolved, and `onSubmit` falls through to the "Location lookup failed" path. Because the URL is wrong regardless of the `city` value, the condition holds for all inputs.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type GeocodeRequest  // a city string submitted for lookup
  OUTPUT: boolean

  // The URL endpoint is wrong regardless of the city value, so the bug is
  // triggered for every geocoding request.
  RETURN requestIsGeocodeCall(input)   // true for any city X
END FUNCTION
```

### Examples

- **"Seattle"**: Expected — geocoding hits Nominatim, resolves to coordinates, and a forecast renders. Actual — request goes to the Census `/invalid` endpoint, fails, and "Location lookup failed" is shown.
- **"New York"**: Expected — resolves to coordinates and proceeds to the NWS forecast lookup. Actual — fails at geocoding; no forecast retrieved.
- **"Chicago"**: Expected — first Nominatim match's lat/lon selected via `pickCoordinates`. Actual — error path, entered city text retained.
- **Edge case "Nonexistentville"** (a genuinely unknown city): Expected after fix — Nominatim returns an empty array and the app shows "City not found" (the not-found path), NOT "Location lookup failed".

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Input validation (`validateCity`): empty, whitespace-only, and over-100-character inputs still show their existing messages without entering the in-progress state.
- The two-step National Weather Service forecast lookup (`getForecast`) runs unchanged after geocoding succeeds.
- Rendering of current conditions and the 5-day forecast table with matching icons (`renderCurrent`, `renderSuccess`, `buildForecastTable`, `formatTemp`, `iconFor`) is unchanged.
- The display-unit toggle (`onToggleUnit`) still re-renders the last successful result between °F and °C with no new network request.
- Genuine geocoding failures (network error, non-OK status, 10-second timeout) still show "Location lookup failed" and retain the entered city text.
- `geocode`'s request mechanics — the descriptive `User-Agent` header, the 10-second `AbortController` timeout, and respecting a caller-provided abort signal — are preserved.

**Scope:**
Every behavior that is not the geocoding endpoint URL must be completely unaffected by this fix. This includes:
- Input validation logic and messages.
- The NWS forecast lookup and all rendering/formatting/icon logic.
- The unit toggle and view-state handling.
- `geocode`'s timeout, abort-signal combination, and header handling.

**Note:** The expected correct behavior (calling the right endpoint) is defined in the Correctness Properties section (Property 1). This section focuses on what must NOT change.

## Hypothesized Root Cause

Based on the bug description and a read of `app.js`, the cause is confirmed by inspection (not merely hypothesized):

1. **Wrong service host**: The URL uses `https://geocoding.geo.census.gov/geocoder/locations/...` (US Census geocoder) instead of `https://nominatim.openstreetmap.org/search` (the Nominatim/OpenStreetMap endpoint the app is designed and documented to use).

2. **Invalid path segment**: The path includes a literal `/invalid` segment, which cannot resolve to a valid geocoding resource.

3. **Resulting failure routing**: The wrong endpoint returns a non-OK HTTP status or triggers a network/CORS error, so the `fetch` promise rejects. `onSubmit`'s `.catch` then shows "Location lookup failed" for every city.

4. **Not a response-shape issue**: `pickCoordinates` already reads `results[0].lat` / `results[0].lon`, which matches Nominatim's response shape, so the defect is isolated to the URL construction line — nothing downstream needs to change.

## Correctness Properties

Property 1: Bug Condition - Geocoding Targets the Correct Nominatim Endpoint

_For any_ input where the bug condition holds (`isBugCondition` returns true — i.e. any geocoding request for a city `X`), the fixed `geocode` function SHALL build and call the Nominatim search endpoint. The constructed URL SHALL start with `https://nominatim.openstreetmap.org/search`, contain `q=<encodeURIComponent(city)>`, `format=json`, and `limit=1`, and SHALL NOT contain `geocoding.geo.census.gov` or `/invalid`. A valid US city SHALL resolve to the first match's coordinates via `pickCoordinates` and proceed to the forecast lookup; an empty result array SHALL yield the "City not found" path (not "Location lookup failed").

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Everything Except the Geocoding URL Is Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition` returns false), the fixed function SHALL produce the same result as the original function. In practice ¬isBugCondition is empty for the geocoding URL itself (every geocode call is affected), so preservation is scoped to the surrounding behavior the fix must not touch: `validateCity`, `pickCoordinates`, `getForecast`, the renderers, the unit toggle, and `geocode`'s 10-second timeout, caller-provided abort-signal handling, and descriptive `User-Agent` header SHALL all behave identically before and after the fix.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

The root cause is confirmed by inspection, so the change is a single-line URL correction.

**File**: `app.js`

**Function**: `geocode(city, signal)`

**Specific Changes**:
1. **Replace the endpoint URL**: Change the `const url = ...` expression from the Census `/invalid` URL to the Nominatim search endpoint.
   - From:
     ```js
     const url = 'https://geocoding.geo.census.gov/geocoder/locations/invalid?q=' +
       encodeURIComponent(city) + '&format=json&limit=1';
     ```
   - To:
     ```js
     const url = 'https://nominatim.openstreetmap.org/search?q=' +
       encodeURIComponent(city) + '&format=json&limit=1';
     ```

2. **Preserve `encodeURIComponent(city)`**: Keep passing the user-entered city straight through `encodeURIComponent` (no hardcoding or storing of city names, per steering).

3. **Leave the request options untouched**: The `AbortController`, 10-second `setTimeout`, caller-`signal` combination, `Accept` and `User-Agent` headers, `.then` status check, `response.json()`, `pickCoordinates(results)` mapping, and the `.finally` cleanup all stay exactly as they are.

4. **No other files or functions change**: `index.html`, pure helpers, DOM writers, `getForecast`, `onSubmit`, and `onToggleUnit` are not modified.

5. **No new structure**: No classes, interfaces, caching, dependencies, or build steps are introduced — consistent with project steering.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the counterexample that demonstrates the bug on the unfixed code, then verify the fix builds the correct URL and preserves existing behavior. Per project steering, test tooling is intentionally minimal — the only automated check is `node --check app.js` to confirm the JavaScript remains valid. The URL and preservation checks below are expressed as properties and verified by inspection/manual reasoning rather than a test framework, since no test infrastructure is used in this project.

### Exploratory Bug Condition Checking

**Goal**: Surface the counterexample that demonstrates the bug BEFORE implementing the fix, and confirm the root cause (wrong endpoint URL). If the counterexample did not reproduce, we would need to re-hypothesize.

**Test Plan**: Inspect the URL that `geocode` constructs on the UNFIXED code and reason about the request it produces. Optionally, submit a known-good US city in the browser and observe the "Location lookup failed" error together with a non-OK/network/CORS failure for the Census endpoint in the network panel.

**Test Cases**:
1. **Known-good city (Seattle)**: Submitting "Seattle" shows "Location lookup failed" (will fail on unfixed code).
2. **Known-good city (New York)**: Submitting "New York" shows "Location lookup failed" (will fail on unfixed code).
3. **URL inspection**: The constructed URL contains `geocoding.geo.census.gov` and `/invalid` (will match the bug on unfixed code).
4. **Edge case (unknown city)**: An unknown city still shows "Location lookup failed" instead of "City not found", because the request never reaches a working endpoint (will fail on unfixed code).

**Expected Counterexamples**:
- The request URL points at `https://geocoding.geo.census.gov/geocoder/locations/invalid`, so the fetch fails before coordinates resolve.
- Possible causes: wrong service host, invalid `/invalid` path segment, resulting non-OK/network/CORS failure.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function builds and calls the correct Nominatim endpoint.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  url := buildGeocodeUrl_fixed(input.city)
  ASSERT url starts_with "https://nominatim.openstreetmap.org/search"
     AND url contains "q=" + encodeURIComponent(input.city)
     AND url contains "format=json"
     AND url contains "limit=1"
     AND url does_not_contain "geocoding.geo.census.gov"
     AND url does_not_contain "/invalid"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT geocode_original(input) = geocode_fixed(input)
END FOR
```

In practice ¬isBugCondition is empty for the geocoding URL itself (every geocode call is affected). Preservation is therefore scoped to the surrounding behavior that the fix must NOT touch: `validateCity`, `pickCoordinates`, `getForecast`, the renderers, the unit toggle, and `geocode`'s timeout/abort/`User-Agent` handling all behave identically before and after the fix.

**Testing Approach**: Because this project uses minimal tooling (no property-based test framework), preservation is verified by scoped inspection: confirm the diff touches only the single `const url` line inside `geocode`, and that no other function or request option is altered. A narrow diff is the strongest practical guarantee that non-URL behavior is unchanged.

**Test Plan**: Observe behavior on the UNFIXED code first for the preserved paths (validation, unit toggle, genuine-failure messaging), then confirm the same behavior after the one-line fix.

**Test Cases**:
1. **Validation Preservation**: Empty, whitespace-only, and over-100-character inputs show their existing messages and do not enter the in-progress state — unchanged after the fix.
2. **Forecast + Rendering Preservation**: After a successful geocode, the two-step NWS lookup and the current-conditions + 5-day table rendering behave as before.
3. **Unit Toggle Preservation**: Toggling °F/°C re-renders the last successful result with no new network request.
4. **Request-Mechanics Preservation**: Genuine geocoding failures still show "Location lookup failed" and retain the entered city text; the `User-Agent` header, 10-second timeout, and caller abort signal still behave as before.

### Unit Tests

- `node --check app.js` passes (the JavaScript remains syntactically valid after the edit). This is the only required automated check per project steering.
- No test framework is added; no further unit test infrastructure is introduced.

### Property-Based Tests

- Not used in this project (steering limits testing to a validity check). The Fix Checking and Preservation Checking properties above stand in as the correctness specification, verified by inspection rather than a generator-based framework.

### Integration Tests

- Manual smoke test in the browser on `localhost:8080` (started via `start-server.ps1`, or `start-server.bat` on path issues): submit a known US city and confirm a forecast renders; submit an unknown city and confirm "City not found"; toggle the unit and confirm re-render with no new request.
