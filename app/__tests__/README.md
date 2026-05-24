# Jest Tests for FieldReportX

This folder contains unit and integration tests for the app using Jest.

## Test Files

### Unit Tests
Tests that verify a single function or module in isolation with no real dependencies.

- **`compare.test.ts`** — confirms Jest itself is running correctly with a simple 1+1=2 check
- **`formatDateTime.test.ts`** — checks that missing/empty input returns a fallback and that a valid date produces the correct formatted output
- **`sanitize.test.ts`** — checks that HTML special characters (&, <, >, etc.) are escaped correctly by `sanitizeText`
- **`statusLabel.test.ts`** — checks that each report status (`draft`, `in_progress` etc.) maps to the correct display label
- **`storageHelper.test.ts`** — checks that reminder preferences are saved, loaded, and cleared correctly using a mocked version of AsyncStorage

### Integration Tests
Tests that verify multiple parts of the system working together with no planted return values — data flows naturally through the full stack.

- **`storageHelperIntegration.test.ts`** — tests the full save → load → clear cycle through `storageHelper` and the in-memory AsyncStorage implementation. Confirms that saved data can be retrieved, cleared data returns null, and new saves overwrite old ones.
- **`login.test.ts`** — renders the real `LoginScreen` component with Firebase replaced by fakes. Tests that valid credentials call `login`, and that empty fields and invalid email formats are caught by client-side validation before Firebase is ever called.

## Running Tests

Run all tests:
```bash
npm test
```

Run a single file:
```bash
npx jest app/__tests__/login.test.ts
```

Run with verbose output:
```bash
npx jest app/__tests__/login.test.ts --verbose
```

Run with coverage report:
```bash
npx jest app/__tests__/login.test.ts --verbose --coverage
```
