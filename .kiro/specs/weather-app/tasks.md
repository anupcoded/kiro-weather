# Implementation Plan: Weather App

## Overview

Build a minimal single-page weather app in plain HTML and JavaScript. The user enters a US
city name, the app geocodes it via Nominatim, then queries the National Weather Service API
to display current conditions and a 5-day forecast with weather icons. The app is served
locally on `http://localhost:8080` by a PowerShell script, with a batch fallback.

Per the project steering rules, the design is kept simple (no caching, classes, or
interfaces; no hardcoded city data) and testing is limited to confirming the JavaScript is
valid with `node --check`. No heavyweight test infrastructure is added.

## Tasks

- [x] 1. Create the HTML shell (`index.html`)
  - Create `index.html` with a form containing a text input `#city-input` (`maxlength` 100)
    for the City_Name and a submit control `#search-button`
  - Add a single result region `#status` used for the in-progress message, results, or errors
  - Load `app.js` from the page
  - _Requirements: 1.1, 1.2, 4.5_

- [x] 2. Implement the pure core functions in `app.js`
  - [x] 2.1 Implement `validateCity(raw)`
    - Trim input; return `{ ok: true, city }` when trimmed length is 1..100, otherwise
      `{ ok: false, message }` with distinct messages for empty/whitespace-only and over-length
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 4.6, 1.6_

  - [x] 2.2 Implement coordinate selection and `pickDailyPeriods(periods)`
    - Select `lat`/`lon` of the first Nominatim match, or `null` when the array is empty
    - Return the first 5 daytime periods (`isDaytime === true`), falling back to the first 5
      periods, preserving order and never exceeding 5
    - _Requirements: 2.3, 2.4, 3.4_

  - [x] 2.3 Implement `formatTemp(value, unit)` and `iconFor(shortForecast)`
    - `formatTemp` rounds to the nearest whole degree and appends a Fahrenheit unit label
    - `iconFor` maps textual conditions to one icon from the known category set
      (sunny, cloudy, rainy, snowy, stormy, foggy, default), defaulting on unknown text
    - _Requirements: 3.2, 3.3_

- [x] 3. Implement the rendering functions in `app.js`
  - Implement `renderStatus(text)`, `renderCurrent(period)`, `renderForecastTable(periods)`,
    and `renderError(message)`, each writing into the single `#status` region and clearing
    prior content so exactly one kind of content is shown
  - _Requirements: 3.2, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Implement the network I/O functions in `app.js`
  - [x] 4.1 Implement `geocode(city, signal)`
    - Call Nominatim `search?q={city}&format=json&limit=1`; return first match coordinates or
      `null` on empty results; throw on network/HTTP error or abort
    - Wrap the call with a 10-second `AbortController` timeout
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 4.2 Implement `getForecast({ lat, lon }, signal)`
    - Call `/points/{lat},{lon}`, follow `properties.forecast`, return `properties.periods`;
      throw on network/HTTP error or abort
    - Wrap the call with a 10-second `AbortController` timeout
    - _Requirements: 3.1, 3.6_

- [x] 5. Wire the controller together in `app.js`
  - Implement `onSubmit(event)`: prevent default, read and trim input, run `validateCity`,
    show the single in-progress status, orchestrate geocode -> points -> forecast, and route
    success to `renderCurrent`/`renderForecastTable` and all failures to `renderError`
  - Guard the "weather conditions unavailable" case when a period lacks temperature or text
  - Retain the entered city text on geocoding failure
  - Register the submit event listener to the form/button
  - _Requirements: 1.3, 2.2, 2.4, 2.5, 3.1, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.6_

- [x] 6. Checkpoint - Validate the JavaScript
  - Run `node --check app.js` to confirm the JavaScript parses
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create the local hosting scripts
  - [x] 7.1 Create `start-server.ps1`
    - Start an HTTP server bound to `localhost:8080` that serves `index.html`/`app.js` and
      returns not-found for missing paths
    - Print the availability message when started, and report when port 8080 is already in use
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.2 Create `start-server.bat` fallback
    - Start the same server at `localhost:8080` as a fallback when path issues block the
      PowerShell script
    - _Requirements: 5.6_

- [x] 8. Final checkpoint - Confirm app validity
  - Run `node --check` on all JavaScript files
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Per the project steering rules, testing is limited to `node --check` validity. No property
  test or unit test infrastructure is added, so the design's Correctness Properties are not
  turned into separate test tasks.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation.
- No city names are hardcoded or stored; the trimmed user input is passed directly to the
  geocoding query (Requirement 1.6).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "7.1", "7.2"] },
    { "id": 1, "tasks": ["2.2"] },
    { "id": 2, "tasks": ["2.3"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["5"] }
  ]
}
```
