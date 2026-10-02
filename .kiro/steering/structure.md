# Structure

Flat project layout at the workspace root.

```
.
├── index.html          # Page markup: search form (#search-form, #city-input,
│                       # #search-button) and single result region (#status)
├── app.js              # All application logic (loaded via <script src>)
├── start-server.ps1    # PowerShell static HTTP server on localhost:8080 (preferred)
├── start-server.bat    # Batch fallback launcher for path issues
├── .gitignore
└── .kiro/
    ├── steering/       # These guidance docs
    └── specs/          # Spec documents (requirements, design, tasks)
```

## app.js organization

Functions are grouped by role, in this order:

1. **Pure helpers** — `validateCity`, `pickCoordinates`, `pickDailyPeriods`, `formatTemp`, `iconFor`.
2. **DOM writers** — `renderStatus`, `renderCurrent`, `renderForecastTable`, `renderError`, `renderSuccess`. All target the single `#status` region and clear it before writing.
3. **I/O** — `geocode` (Nominatim), `getForecast` (two-step NWS lookup).
4. **Controller / wiring** — `onSubmit` orchestrates one lookup; a DOM-ready guard registers the form submit handler.

## Conventions

- The `#status` region shows exactly one state at a time: in-progress status, results, or an error message.
- DOM access is guarded for non-browser environments (`typeof document === 'undefined'`), so pure functions stay testable with `node --check`.
- Add new UI element IDs to `index.html` and reference them from `app.js`; do not inline markup strings where a DOM writer fits.
