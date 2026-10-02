// Bug condition exploration test (Task 1) for the geocoding-service-fix bugfix spec.
//
// Property 1: Bug Condition - Geocoding Targets the Correct Nominatim Endpoint
// Validates: Requirements 1.1, 1.2, 1.3 (and encodes expected Requirements 2.1)
//
// This test loads the REAL geocode() from app.js, stubs fetch/AbortController so
// nothing goes over the network, and captures the exact URL geocode() builds for
// each representative city. It then asserts the EXPECTED (post-fix) Nominatim URL.
//
// On the UNFIXED code this assertion is EXPECTED TO FAIL: the captured URL points
// at the Census `/invalid` endpoint. That failure IS the counterexample proving
// the bug exists. After the one-line fix in task 3.1 this same test should pass.
//
// Run: node geocode-url.explore.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Scoped representative cities (per task): known-good + a genuinely unknown one.
const CITIES = ['Seattle', 'New York', 'Nonexistentville'];

// --- Load app.js into a sandbox with a fetch stub that captures the URL. ---
function loadGeocode() {
  const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

  const captured = { url: null };

  // Minimal AbortController stub (app.js constructs one internally).
  class FakeAbortController {
    constructor() {
      this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    }
    abort() {
      this.signal.aborted = true;
    }
  }

  // fetch stub: record the URL geocode asks for, then resolve a benign empty
  // result so the promise chain completes without touching the network.
  function fakeFetch(url) {
    captured.url = url;
    return Promise.resolve({
      ok: true,
      status: 200,
      json() {
        return Promise.resolve([]);
      }
    });
  }

  const sandbox = {
    fetch: fakeFetch,
    AbortController: FakeAbortController,
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    console: console
    // Note: no `document`, so app.js's DOM wiring guard is skipped.
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'app.js' });

  return { geocode: sandbox.geocode, captured };
}

// --- Expected (post-fix) assertion from Property 1 / design. ---
function checkExpectedUrl(city, url) {
  const problems = [];
  const expectedStart = 'https://nominatim.openstreetmap.org/search';
  if (url == null) {
    problems.push('no URL was constructed');
    return problems;
  }
  if (url.indexOf(expectedStart) !== 0) {
    problems.push('does not start with ' + expectedStart);
  }
  if (url.indexOf('q=' + encodeURIComponent(city)) === -1) {
    problems.push('missing q=' + encodeURIComponent(city));
  }
  if (url.indexOf('format=json') === -1) {
    problems.push('missing format=json');
  }
  if (url.indexOf('limit=1') === -1) {
    problems.push('missing limit=1');
  }
  if (url.indexOf('geocoding.geo.census.gov') !== -1) {
    problems.push('still contains geocoding.geo.census.gov');
  }
  if (url.indexOf('/invalid') !== -1) {
    problems.push('still contains /invalid');
  }
  return problems;
}

async function main() {
  const { geocode, captured } = loadGeocode();
  const counterexamples = [];
  let allPass = true;

  for (const city of CITIES) {
    captured.url = null;
    try {
      await geocode(city, null);
    } catch (e) {
      // A thrown error is fine for URL inspection; we only need the captured URL.
    }
    const url = captured.url;
    const problems = checkExpectedUrl(city, url);
    if (problems.length === 0) {
      console.log('PASS  ' + JSON.stringify(city) + ' -> ' + url);
    } else {
      allPass = false;
      counterexamples.push({ city: city, url: url, problems: problems });
      console.log('FAIL  ' + JSON.stringify(city) + ' -> ' + url);
      problems.forEach(function (p) { console.log('        - ' + p); });
    }
  }

  console.log('');
  if (allPass) {
    console.log('RESULT: PASS - geocode builds the correct Nominatim URL for all cities.');
    process.exitCode = 0;
  } else {
    console.log('RESULT: FAIL - bug confirmed. Counterexamples:');
    counterexamples.forEach(function (c) {
      console.log('  city=' + JSON.stringify(c.city) + ' url=' + c.url);
    });
    process.exitCode = 1;
  }
}

main();
