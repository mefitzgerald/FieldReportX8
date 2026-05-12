# Maestro E2E Tests for FieldReportX

This directory contains end-to-end tests for the FieldReportX app using Maestro.

## Prerequisites

1. Install Maestro: https://maestro.mobile.dev/getting-started/installing-maestro
2. Have an Android device or emulator running
3. Create a test account on Firebase (e.g., testuser@fieldreportx.com / Test123456)

## Running Tests

### Run all tests:

```bash
maestro test e2e/
```

### Run a specific test:

```bash
maestro test e2e/create-report.yaml
```

### Run with verbose output:

```bash
maestro --verbose test e2e/create-report.yaml
```

### Create Reports

maestro test --format junit --output e2e/reports/report.xml e2e/create-report.yaml
maestro test --format html-detailed --output e2e/reports/detailed-report.html e2e/create-report.yaml

## Test Files

- **create-report.yaml** - Complete end-to-end test: Login → Create report with gyroscope data → Submit → Verify in History

## Notes

- Update the email/password in the test files to match your test account credentials
- Tests expect the app to be built and installed on the device
