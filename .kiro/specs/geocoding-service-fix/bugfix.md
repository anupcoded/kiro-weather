# Bugfix Requirements Document

## Introduction

Every city entered into the weather app's search returns an error such as "Unable to reach the geocoding service" / "Location lookup failed", so no user can retrieve a forecast. The app worked previously.

The root cause is in the `geocode(city, signal)` function in `app.js`. It builds its request URL against the wrong service and an invalid path:

```
https://geocoding.geo.census.gov/geocoder/locations/invalid?q=<city>&format=json&limit=1
```

This targets the US Census geocoder (not the Nominatim/OpenStreetMap endpoint the app is designed and documented to use) and includes an obviously invalid `/invalid` path segment. Every geocoding request therefore fails with a non-OK HTTP status or network/CORS error, routing every city to the "Location lookup failed" path in `onSubmit`. The fix is to call the correct Nominatim search endpoint so valid US cities resolve to coordinates again. The downstream response handling (`pickCoordinates` reading `results[0].lat` / `results[0].lon`) already matches Nominatim's response shape and does not change.

## Bug Analysis

### Current Behavior (Defect)

When a user submits any city, the geocoding request is sent to the wrong endpoint and fails before coordinates can be resolved.

1.1 WHEN a user submits any valid US city name THEN the system issues the geocoding request to `https://geocoding.geo.census.gov/geocoder/locations/invalid` instead of the Nominatim endpoint
1.2 WHEN the geocoding request is sent to that incorrect endpoint THEN the system receives a non-OK HTTP status or network/CORS error and the request fails
1.3 WHEN the geocoding request fails THEN the system shows the "Location lookup failed" error and no forecast is ever retrieved, for every city

### Expected Behavior (Correct)

When a user submits a city, the geocoding request should go to the correct Nominatim endpoint so a valid US city resolves to coordinates.

2.1 WHEN a user submits any valid US city name THEN the system SHALL issue the geocoding request to the Nominatim search endpoint `https://nominatim.openstreetmap.org/search?q=<city>&format=json&limit=1`
2.2 WHEN the Nominatim request returns at least one match THEN the system SHALL resolve the first match's coordinates (via `pickCoordinates`) and proceed to the forecast lookup
2.3 WHEN the Nominatim request returns an empty result array THEN the system SHALL show the "City not found" message (the not-found path), not the "Location lookup failed" error

### Unchanged Behavior (Regression Prevention)

All behavior unrelated to the geocoding endpoint must stay exactly as it is.

3.1 WHEN input is empty, whitespace-only, or over 100 characters THEN the system SHALL CONTINUE TO show the existing validation messages without entering the in-progress state
3.2 WHEN geocoding succeeds THEN the system SHALL CONTINUE TO perform the two-step National Weather Service forecast lookup (`getForecast`) unchanged
3.3 WHEN a forecast is retrieved THEN the system SHALL CONTINUE TO render current conditions and the 5-day forecast table with matching icons unchanged
3.4 WHEN the user toggles the display unit THEN the system SHALL CONTINUE TO re-render the last successful result between °F and °C without a new network request
3.5 WHEN any genuine geocoding network error, non-OK status, or 10-second timeout occurs THEN the system SHALL CONTINUE TO show "Location lookup failed" and retain the entered city text
3.6 WHEN geocoding is performed THEN the system SHALL CONTINUE TO use the descriptive `User-Agent` header, the 10-second `AbortController` timeout, and respect a caller-provided abort signal

## Bug Condition and Properties

**Key Definitions:**
- **F**: The original `geocode(city, signal)` function (builds the Census `/invalid` URL).
- **F'**: The fixed `geocode(city, signal)` function (builds the Nominatim URL).

### Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type GeocodeRequest  // a city string submitted for lookup
  OUTPUT: boolean

  // The bug is triggered for every city search, because the endpoint URL is
  // wrong regardless of the city value.
  RETURN true  // equivalently: the request is a geocoding request for any city X
END FUNCTION
```

### Fix Checking

```pascal
// Property: Fix Checking - geocoding targets the correct Nominatim endpoint
FOR ALL X WHERE isBugCondition(X) DO
  url ← buildGeocodeUrl'(X.city)
  ASSERT url starts_with "https://nominatim.openstreetmap.org/search"
     AND url contains "q=" + encodeURIComponent(X.city)
     AND url contains "format=json"
     AND url contains "limit=1"
     AND url does_not_contain "geocoding.geo.census.gov"
     AND url does_not_contain "/invalid"
END FOR
```

### Preservation Checking

```pascal
// Property: Preservation Checking - everything except the geocoding URL is unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR

// In practice ¬isBugCondition is empty for the geocoding URL itself (every
// geocode call is affected). Preservation is therefore scoped to the surrounding
// behavior that the fix must NOT touch: validateCity, pickCoordinates,
// getForecast, the renderers, the unit toggle, and geocode's timeout/abort/
// User-Agent handling all behave identically before and after the fix.
```
