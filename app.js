// Weather App - plain functions (no classes, no interfaces, no caching).
// City names are never hardcoded or stored; user input flows straight to the API.

// --- Validation (pure) ---

// validateCity(raw) -> { ok: true, city } | { ok: false, message }
// Trims the input, accepts a trimmed length of 1..100 characters, and rejects
// empty/whitespace-only and over-length input with distinct messages.
function validateCity(raw) {
  const city = (raw == null ? '' : String(raw)).trim();
  if (city.length === 0) {
    return { ok: false, message: 'Please enter a city name.' };
  }
  if (city.length > 100) {
    return { ok: false, message: 'City name must be 100 characters or fewer.' };
  }
  return { ok: true, city };
}
// --- Coordinate selection (pure) ---

// pickCoordinates(results) -> { lat, lon } | null
// Returns the lat/lon of the first Nominatim match when the array is non-empty,
// or null when there are no matches (the "not found" path).
function pickCoordinates(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }
  const first = results[0];
  if (first == null) {
    return null;
  }
  return { lat: first.lat, lon: first.lon };
}

// --- Daily period selection (pure) ---

// pickDailyPeriods(periods) -> Array<Period>
// Returns the first 5 daytime periods (isDaytime === true). If no daytime periods
// are present, falls back to the first 5 periods. Order is preserved and the result
// never exceeds 5 periods.
function pickDailyPeriods(periods) {
  if (!Array.isArray(periods)) {
    return [];
  }
  const daytime = periods.filter(function (p) {
    return p != null && p.isDaytime === true;
  });
  const source = daytime.length > 0 ? daytime : periods;
  return source.slice(0, 5);
}

// --- Temperature formatting (pure) ---

// convertTemp(value, sourceUnit, displayUnit) -> number
// Converts a numeric temperature from its source unit ('F' or 'C', as reported
// by the forecast) into the requested display unit ('F' or 'C'). Returns the
// value unchanged when the units already match. Pure and total for finite input.
function convertTemp(value, sourceUnit, displayUnit) {
  const num = Number(value);
  const from = (sourceUnit == null ? 'F' : String(sourceUnit)).toUpperCase();
  const to = (displayUnit == null ? 'F' : String(displayUnit)).toUpperCase();
  if (from === to) {
    return num;
  }
  if (from === 'F' && to === 'C') {
    return (num - 32) * 5 / 9;
  }
  if (from === 'C' && to === 'F') {
    return num * 9 / 5 + 32;
  }
  return num;
}

// formatTemp(value, unit, displayUnit) -> string
// Converts the numeric temperature from its source `unit` (e.g. 'F' from NWS) to
// the requested `displayUnit` ('F' default, or 'C'), rounds to the nearest whole
// degree, and appends the matching unit label (e.g. "72°F" or "22°C").
function formatTemp(value, unit, displayUnit) {
  const display = (displayUnit == null ? 'F' : String(displayUnit)).toUpperCase();
  const converted = convertTemp(value, unit, display);
  const rounded = Math.round(converted);
  return rounded + '\u00B0' + (display === 'C' ? 'C' : 'F');
}

// --- Icon selection (pure) ---

// iconFor(shortForecast) -> string
// Maps a textual forecast condition to exactly one icon from the known category
// set (sunny, cloudy, rainy, snowy, stormy, foggy, default) by keyword matching.
// Any text with no recognized keyword maps to the default icon. This is a total
// function: it never returns an empty string.
function iconFor(shortForecast) {
  const text = (shortForecast == null ? '' : String(shortForecast)).toLowerCase();

  // Order matters: more specific/severe conditions are checked first so that,
  // for example, "thunderstorm" maps to stormy rather than rainy.
  if (text.indexOf('thunder') !== -1 || text.indexOf('storm') !== -1) {
    return '\u26C8\uFE0F'; // stormy
  }
  if (text.indexOf('snow') !== -1 || text.indexOf('sleet') !== -1 ||
      text.indexOf('flurr') !== -1 || text.indexOf('blizzard') !== -1 ||
      text.indexOf('ice') !== -1 || text.indexOf('wintry') !== -1) {
    return '\u2744\uFE0F'; // snowy
  }
  if (text.indexOf('rain') !== -1 || text.indexOf('shower') !== -1 ||
      text.indexOf('drizzle') !== -1) {
    return '\uD83C\uDF27\uFE0F'; // rainy
  }
  if (text.indexOf('fog') !== -1 || text.indexOf('mist') !== -1 ||
      text.indexOf('haze') !== -1 || text.indexOf('smoke') !== -1) {
    return '\uD83C\uDF2B\uFE0F'; // foggy
  }
  if (text.indexOf('cloud') !== -1 || text.indexOf('overcast') !== -1) {
    return '\u2601\uFE0F'; // cloudy
  }
  if (text.indexOf('sun') !== -1 || text.indexOf('clear') !== -1 ||
      text.indexOf('fair') !== -1) {
    return '\u2600\uFE0F'; // sunny
  }
  return '\uD83C\uDF21\uFE0F'; // default (thermometer)
}

// --- Display unit state ---
// The currently selected display unit ('F' default, or 'C') and the last
// successful forecast data, kept so the toggle can re-render without a new
// network request. This is view state only; no city names are stored.
let displayUnit = 'F';
let lastResult = null; // { firstPeriod, periods } | null

// --- Rendering (DOM writers) ---
// Each writer targets the single result region (#status) and clears any prior
// content first, so the region shows exactly one kind of content at a time
// (in-progress status, results, or an error).

// statusRegion() -> HTMLElement | null
// Looks up the single result region. Kept as a helper so every writer resolves
// the same element and the clear-then-write behavior stays consistent.
function statusRegion() {
  return typeof document === 'undefined'
    ? null
    : document.getElementById('status');
}

// renderStatus(text) -> void
// Writes the single in-progress status message, replacing any prior content.
function renderStatus(text) {
  const region = statusRegion();
  if (region == null) {
    return;
  }
  region.textContent = text == null ? '' : String(text);
}

// renderCurrent(period) -> void
// Writes the current temperature (°F), short forecast text, and the matching
// icon, replacing any prior content. Reuses formatTemp and iconFor.
function renderCurrent(period) {
  const region = statusRegion();
  if (region == null) {
    return;
  }
  region.textContent = '';

  const p = period == null ? {} : period;
  const container = document.createElement('div');

  const temp = document.createElement('span');
  temp.textContent = formatTemp(p.temperature, p.temperatureUnit, displayUnit);

  const condition = document.createElement('span');
  condition.textContent = ' ' + iconFor(p.shortForecast) + ' ' +
    (p.shortForecast == null ? '' : String(p.shortForecast));

  container.appendChild(temp);
  container.appendChild(condition);
  region.appendChild(container);
}

// renderForecastTable(periods) -> void
// Writes a table with one row per day (day, temperature, short condition, icon),
// replacing any prior content. Reuses pickDailyPeriods, formatTemp, and iconFor.
function renderForecastTable(periods) {
  const region = statusRegion();
  if (region == null) {
    return;
  }
  region.textContent = '';

  const daily = pickDailyPeriods(periods);

  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Day', 'Temperature', 'Condition', 'Icon'].forEach(function (label) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  daily.forEach(function (p) {
    const row = p == null ? {} : p;
    const tr = document.createElement('tr');

    const dayCell = document.createElement('td');
    dayCell.textContent = row.name == null ? '' : String(row.name);

    const tempCell = document.createElement('td');
    tempCell.textContent = formatTemp(row.temperature, row.temperatureUnit, displayUnit);

    const conditionCell = document.createElement('td');
    conditionCell.textContent = row.shortForecast == null
      ? ''
      : String(row.shortForecast);

    const iconCell = document.createElement('td');
    iconCell.textContent = iconFor(row.shortForecast);

    tr.appendChild(dayCell);
    tr.appendChild(tempCell);
    tr.appendChild(conditionCell);
    tr.appendChild(iconCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  region.appendChild(table);
}

// renderError(message) -> void
// Writes an error message, replacing any prior content.
function renderError(message) {
  const region = statusRegion();
  if (region == null) {
    return;
  }
  region.textContent = message == null ? '' : String(message);
}

// --- Geocoding (I/O) ---

// geocode(city, signal) -> Promise<{ lat, lon } | null>
// Calls the Nominatim search endpoint for the given city and returns the
// coordinates of the first match (via pickCoordinates), or null when the result
// array is empty (the "not found" path). Throws on network error, non-OK HTTP
// status, or abort/timeout.
//
// The request is bounded by a 10-second timeout via an internal AbortController.
// If a caller-provided `signal` is passed, it is also respected: aborting either
// the caller's signal or the internal timeout aborts the fetch.
function geocode(city, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, 10000);

  // Combine the caller's signal (if any) with the internal timeout controller so
  // that aborting either one aborts the fetch.
  function onExternalAbort() {
    controller.abort();
  }
  if (signal != null) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort);
    }
  }

  const url = 'https://geocoding.geo.census.gov/geocoder/locations/invalid?q=' +
    encodeURIComponent(city) + '&format=json&limit=1';

  return fetch(url, {
    signal: controller.signal,
    headers: {
      // Nominatim usage policy asks for a descriptive identifier.
      'Accept': 'application/json',
      'User-Agent': 'WeatherApp/1.0 (simple weather lookup demo)'
    }
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Geocoding request failed with status ' + response.status);
      }
      return response.json();
    })
    .then(function (results) {
      return pickCoordinates(results);
    })
    .finally(function () {
      clearTimeout(timeoutId);
      if (signal != null) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    });
}

// --- Weather forecast (I/O) ---

// getForecast({ lat, lon }, signal) -> Promise<Array<Period>>
// Performs the two-step National Weather Service lookup for a set of coordinates:
//   1. GET /points/{lat},{lon} -> read properties.forecast (a forecast resource URL).
//   2. GET that forecast URL   -> return properties.periods (an ordered array).
// Throws on network error, non-OK HTTP status (either request), or abort/timeout.
//
// The whole operation (both requests) is bounded by a single 10-second timeout via
// an internal AbortController. If a caller-provided `signal` is passed, it is also
// respected: aborting either the caller's signal or the internal timeout aborts the
// in-flight fetch.
function getForecast(coordinates, signal) {
  const coords = coordinates == null ? {} : coordinates;
  const lat = coords.lat;
  const lon = coords.lon;

  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, 10000);

  // Combine the caller's signal (if any) with the internal timeout controller so
  // that aborting either one aborts the fetch.
  function onExternalAbort() {
    controller.abort();
  }
  if (signal != null) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort);
    }
  }

  const requestInit = {
    signal: controller.signal,
    headers: {
      // NWS recommends sending a descriptive User-Agent identifying the app.
      'Accept': 'application/geo+json',
      'User-Agent': 'WeatherApp/1.0 (simple weather lookup demo)'
    }
  };

  const pointsUrl = 'https://api.weather.gov/points/' +
    encodeURIComponent(lat) + ',' + encodeURIComponent(lon);

  return fetch(pointsUrl, requestInit)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Weather points request failed with status ' + response.status);
      }
      return response.json();
    })
    .then(function (pointsData) {
      const forecastUrl = pointsData != null && pointsData.properties != null
        ? pointsData.properties.forecast
        : null;
      if (forecastUrl == null) {
        throw new Error('Weather points response did not include a forecast URL.');
      }
      return fetch(forecastUrl, requestInit);
    })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Weather forecast request failed with status ' + response.status);
      }
      return response.json();
    })
    .then(function (forecastData) {
      return forecastData != null && forecastData.properties != null
        ? forecastData.properties.periods
        : undefined;
    })
    .finally(function () {
      clearTimeout(timeoutId);
      if (signal != null) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    });
}

// --- Controller / wiring ---

// buildForecastTable(periods) -> HTMLElement
// Builds (but does not insert) the 5-day forecast table element, reusing
// pickDailyPeriods, formatTemp, and iconFor. Kept separate so the success render
// can show the current conditions and the table together in the single region
// without one clearing the other.
function buildForecastTable(periods) {
  const daily = pickDailyPeriods(periods);

  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Day', 'Temperature', 'Condition', 'Icon'].forEach(function (label) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  daily.forEach(function (p) {
    const row = p == null ? {} : p;
    const tr = document.createElement('tr');

    const dayCell = document.createElement('td');
    dayCell.textContent = row.name == null ? '' : String(row.name);

    const tempCell = document.createElement('td');
    tempCell.textContent = formatTemp(row.temperature, row.temperatureUnit, displayUnit);

    const conditionCell = document.createElement('td');
    conditionCell.textContent = row.shortForecast == null
      ? ''
      : String(row.shortForecast);

    const iconCell = document.createElement('td');
    iconCell.textContent = iconFor(row.shortForecast);

    tr.appendChild(dayCell);
    tr.appendChild(tempCell);
    tr.appendChild(conditionCell);
    tr.appendChild(iconCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  return table;
}

// renderSuccess(firstPeriod, periods) -> void
// Replaces the in-progress status with the successful results: the current
// conditions (renderCurrent) followed by the 5-day forecast table. Both are
// written into the single #status region as one logical "results" state so the
// single-status invariant holds (region shows exactly one of: status, results,
// or error).
function renderSuccess(firstPeriod, periods) {
  // Remember the data so the unit toggle can re-render without a new request.
  lastResult = { firstPeriod: firstPeriod, periods: periods };
  // renderCurrent clears the region and writes the current conditions.
  renderCurrent(firstPeriod);
  // Append the forecast table into the same region without clearing it, so the
  // current conditions and the table coexist as the single results view.
  const region = statusRegion();
  if (region == null) {
    return;
  }
  region.appendChild(buildForecastTable(periods));
}

// hasUsableCurrent(period) -> boolean
// True when the current (first) period carries both a usable temperature value
// and a textual forecast. Used to guard the "weather conditions unavailable"
// case (Requirement 3.5).
function hasUsableCurrent(period) {
  if (period == null) {
    return false;
  }
  const tempNum = Number(period.temperature);
  const hasTemp = period.temperature != null && isFinite(tempNum);
  const hasText = period.shortForecast != null &&
    String(period.shortForecast).trim().length > 0;
  return hasTemp && hasText;
}

// onSubmit(event) -> Promise<void>
// Orchestrates a single lookup:
//   1. prevent the form's default submit.
//   2. read + trim the input, validate it; on invalid input show the validation
//      message and do NOT enter the in-progress state (Req 1.4, 1.5, 2.2, 4.6).
//   3. show the single in-progress status (Req 4.1, 4.2).
//   4. geocode -> null means "city not found" (Req 2.4); a throw/timeout means
//      "location lookup failed" and the entered city text is retained (Req 2.5).
//   5. getForecast -> a throw/timeout means "weather lookup failed" (Req 3.6).
//   6. guard "weather conditions unavailable" when periods are missing/empty or
//      the first period lacks a temperature or textual forecast (Req 3.5).
//   7. on success replace the status with current conditions + 5-day table
//      (Req 3.1, 4.3).
function onSubmit(event) {
  if (event != null && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const input = typeof document === 'undefined'
    ? null
    : document.getElementById('city-input');
  const raw = input == null ? '' : input.value;

  const result = validateCity(raw);
  if (!result.ok) {
    // Invalid input: show the message and do not enter the in-progress state.
    renderError(result.message);
    return Promise.resolve();
  }

  const city = result.city;

  // Enter the single lookup-in-progress state spanning both network requests.
  renderStatus('Looking up weather\u2026');

  // Geocode the city, then run the two-step weather lookup. Each failure path
  // routes to renderError, replacing the in-progress status (single-status
  // invariant). Geocoding and weather failures carry distinct messages.
  return geocode(city)
    .then(function (coords) {
      if (coords == null) {
        // No matching location: not-found path, no weather lookup.
        renderError('City not found');
        return;
      }

      return getForecast(coords)
        .then(function (periods) {
          const firstPeriod = Array.isArray(periods) && periods.length > 0
            ? periods[0]
            : null;

          if (firstPeriod == null || !hasUsableCurrent(firstPeriod)) {
            // Missing/empty periods, or the current period lacks a temperature
            // or textual forecast.
            renderError('Current weather conditions are unavailable');
            return;
          }

          renderSuccess(firstPeriod, periods);
        })
        .catch(function () {
          // Network error, non-OK status, or 10-second timeout on the weather
          // requests.
          renderError('Weather lookup failed');
        });
    })
    .catch(function () {
      // Geocoding network error, non-OK status, or 10-second timeout. Retain the
      // entered city text so the user does not have to retype it.
      if (input != null) {
        input.value = city;
      }
      renderError('Location lookup failed');
    });
}

// onToggleUnit() -> void
// Flips the display unit between Fahrenheit and Celsius, updates the toggle
// button label/pressed state, and re-renders the last successful results in the
// new unit without issuing a new network request. Does nothing to the results
// region when there is no prior successful result to re-render.
function onToggleUnit() {
  displayUnit = displayUnit === 'F' ? 'C' : 'F';

  const toggle = typeof document === 'undefined'
    ? null
    : document.getElementById('unit-toggle');
  if (toggle != null) {
    // The button offers the unit you are NOT currently viewing.
    toggle.textContent = displayUnit === 'F' ? 'Show \u00B0C' : 'Show \u00B0F';
    toggle.setAttribute('aria-pressed', displayUnit === 'C' ? 'true' : 'false');
  }

  if (lastResult != null) {
    renderSuccess(lastResult.firstPeriod, lastResult.periods);
  }
}

// Register the submit handler once the DOM is ready, guarded so it only runs in a
// browser environment (where `document` exists). Preferring the form's submit
// event covers both the button click and the Enter key.
if (typeof document !== 'undefined') {
  function wireUp() {
    const toggle = document.getElementById('unit-toggle');
    if (toggle != null) {
      toggle.addEventListener('click', onToggleUnit);
    }

    const form = document.getElementById('search-form');
    if (form != null) {
      form.addEventListener('submit', onSubmit);
      return;
    }
    // Fallback: wire the button directly if the form is not present.
    const button = document.getElementById('search-button');
    if (button != null) {
      button.addEventListener('click', onSubmit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUp);
  } else {
    wireUp();
  }
}
