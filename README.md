# @ralphk66/vitest-teamcity-reporter

TeamCity reporter for [Vitest](https://vitest.dev). Outputs [TeamCity service messages](https://www.jetbrains.com/help/teamcity/service-messages.html) so test results appear in real-time on the Tests tab.

## Install

```bash
npm install -D @ralphk66/vitest-teamcity-reporter
```

## Usage

**vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: process.env.TEAMCITY_VERSION ? ["@ralphk66/vitest-teamcity-reporter"] : ["default"],
  },
});
```

Or from the CLI:

```bash
vitest --reporter=@ralphk66/vitest-teamcity-reporter
```

## What it reports

- **Suites** &mdash; file and `describe` blocks as `testSuiteStarted`/`testSuiteFinished`
- **Tests** &mdash; `testStarted`/`testFinished` with duration
- **Failures** &mdash; `testFailed` with message, stack trace, and `comparisonFailure` when `expected`/`actual` are available
- **Skipped** &mdash; `testIgnored` for `skip`/`todo` tests; skipped suites are suppressed entirely
- **Console output** &mdash; `testStdOut`/`testStdErr` forwarded per test
- **Parallel safety** &mdash; `flowId` per module so interleaved output from concurrent files is handled correctly

## License

MIT
