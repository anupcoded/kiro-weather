# Tech

## Stack

- Plain HTML and vanilla JavaScript. No frameworks, no build step, no bundler.
- No dependencies / no `node_modules` required to run the app.
- Browser APIs only: `fetch`, `AbortController`, DOM manipulation.

## External APIs

- Nominatim (OpenStreetMap) for geocoding: `https://nominatim.openstreetmap.org/search`
- National Weather Service for forecasts: `https://api.weather.gov/points/{lat},{lon}` then the returned forecast URL.
- Both requests send a descriptive `User-Agent` and are bounded by a 10-second timeout via `AbortController`.

## Code style

- Plain functions only. Do not introduce classes, interfaces, or caching.
- Keep pure logic (validation, selection, formatting, icon mapping) separate from I/O (fetch) and DOM writers.
- Favor small, single-purpose, total functions (e.g. `iconFor` always returns an icon).

## Running the app

Run a local HTTP server on `localhost:8080` (do not open `index.html` via `file://`).

- Preferred: `powershell -NoProfile -ExecutionPolicy Bypass -File start-server.ps1`
- Fallback for path issues: `start-server.bat`

The server serves static files from the project folder and returns 404 for missing paths. If port 8080 is in use, it prints a message and does not start.

## Testing

- Keep testing minimal. Validity check only: `node --check app.js`.
- No test framework or additional test infrastructure is needed for this project.
