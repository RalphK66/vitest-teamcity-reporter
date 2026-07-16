# vitest-teamcity-reporter

Vitest reporter that outputs TeamCity service messages to stdout.

## Structure

- `src/index.ts` — the entire reporter (~120 lines)
- `test/unit.test.ts` — escape/format function tests
- `test/reporter.test.ts` — reporter lifecycle tests with mocked vitest objects

## Dev commands

- `npm test` — run tests
- `npm run lint` — oxlint
- `npm run fmt` — oxfmt
- `npm run build` — tsup (esm+cjs) then tsc (declarations)

## Key decisions

- All vitest imports are type-only; the built JS has zero runtime deps
- `flowId` uses `testModule.moduleId` (absolute path) for correct parallel handling
- Unicode line separators (``, ` `, ` `) are escaped per the TC spec
- ANSI codes are stripped before escaping
- Skipped suites (`describe.skip`/`describe.todo`) are suppressed — no empty suite noise
- If `onTestCaseReady` never fires (hook crash), `testStarted` is emitted retroactively
