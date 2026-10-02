# Product

A simple browser-based Weather App. A user enters a US city name and gets back the current conditions plus a 5-day forecast, each with a matching weather icon.

## How it works

1. The user types a city name and submits the form.
2. The app geocodes the city to coordinates using the Nominatim (OpenStreetMap) API.
3. The app looks up the forecast for those coordinates using the National Weather Service (api.weather.gov) API.
4. Results (current conditions + 5-day table) render into a single status region on the page.

## Key constraints

- City names are never hardcoded or stored. User input is passed directly to the geocoding API.
- Nominatim is used for geocoding to avoid CORS issues with the weather API.
- Coverage is US-only (the National Weather Service covers US locations).
- Keep the design simple; the project is meant to be completed quickly.
