# Jest Tests for FieldReportX

This folder contains the unit tests for the app using Jest.

## Current Tests

- `compare.test.ts` - a simple 1+1=2 check that confirms Jest itself is running correctly
- `formatDateTime.test.ts` - checks that missing/empty input returns a fallback, and that a valid date produces a sensible result
- `login.test.ts` - checks that the login screen loads without crashing when Firebase is replaced with fakes
- `sanitize.test.ts` - checks that HTML special characters are escaped correctly by `sanitizeText`
- `statusLabel.test.ts` - checks that each report status (draft, in_progress, etc.) maps to the right display label
- `storageHelper.test.ts` - checks that reminder preferences are saved, loaded, and cleared correctly using a fake version of AsyncStorage

## Running Tests

Run a single test file:

```bash
npx jest formatDateTime
```

Run all tests:

```bash
npm test
```
