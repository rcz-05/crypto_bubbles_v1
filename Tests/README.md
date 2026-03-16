# Tests

This folder contains the Sprint 3 testing setup, automated test suite, and testing documentation for the web-first prototype in `web/`.

## What Is Here

- `api/`: API route tests for `/api/market`, `/api/context`, and `/api/favorites`
- `components/`: component tests for the bubble chart, modal, and tabs
- `hooks/`: hook tests for measurement and shake-refresh behavior
- `lib/`: tests for data fetching, context generation, favorites helpers, and telemetry helpers
- `pages/`: page-level interaction tests for home, favorites, and settings
- `store/`: Zustand store tests
- `fixtures/`: reusable test data
- `setup.ts`, `vitest.config.ts`, `tsconfig.json`: shared test configuration
- `TEST_PLAN.md`: automated test plan
- `test_result.md`: automated test execution summary
- `sprint3_evaluation_report.md`: Sprint 3 testing/evaluation write-up

## How To Run

Run everything from the repo root:

```bash
npm --prefix web install
npm --prefix web run test
npm --prefix web run test:coverage
npm --prefix web run lint
npm --prefix web run build
```

You can also run from inside `web/`:

```bash
npm install
npm run test
npm run test:coverage
npm run lint
npm run build
```

## Coverage Output

The coverage report is generated on demand by:

```bash
npm --prefix web run test:coverage
```

After that command runs, the HTML report will be created in `Tests/coverage/index.html`.

## Current Automated Test Summary

Current verified results from this repo:

- 18 test files passed
- 42 tests passed
- 0 tests failed
- `npm run lint` passed
- `npm run build` passed

## Automated Test Table

| Test Type | What We Tested | Why This Was Designed | Current Result |
|---|---|---|---|
| Unit testing | Fetchers, context builder, favorites helpers, telemetry helpers, Zustand stores | To isolate the core logic behind the prototype and catch regressions early | Passed |
| Data and dataset testing | Market-data normalization, coin lookup, cache reuse and expiry, curated and fallback context generation | To verify that both fixture-backed and live-style data paths produce stable outputs | Passed |
| API testing | `/api/market`, `/api/context`, `/api/favorites` success and failure paths, validation, caching, fallback behavior | To verify the frontend’s server-side contract boundary | Passed |
| Database functionality | Favorites CRUD through in-memory fallback and mocked Postgres flow | To confirm persistence logic works even without a live database in the test environment | Passed |
| Frontend and interaction testing | Bubble board, modal states, search, refresh, settings export/reset, page flows, custom hooks | To verify that the actual scan-to-tap-to-interpret UI works correctly | Passed |
| Quality validation | Linting, production build, and coverage run | To confirm the prototype is stable, buildable, and broadly exercised by tests | Passed |

## Current Coverage

The latest automated coverage numbers are:

- Statements: `91.79%`
- Branches: `72.09%`
- Functions: `95.57%`
- Lines: `94.96%`

Coverage means how much of the code was actually exercised by the tests. High coverage does not prove the app is bug-free, but it does show that the suite is testing most of the codebase rather than only a narrow happy path.
