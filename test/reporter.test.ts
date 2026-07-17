import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TeamCityReporter } from "../src/index.js";

function mockTestModule(overrides: Record<string, any> = {}) {
  return {
    moduleId: "/project/src/math.test.ts",
    project: { vitest: { config: { root: "/project" } } },
    ...overrides,
  };
}

function mockTestSuite(overrides: Record<string, any> = {}) {
  return {
    id: "suite-1",
    name: "addition",
    module: mockTestModule(),
    options: { mode: "run" },
    ...overrides,
  };
}

function mockTestCase(overrides: Record<string, any> = {}) {
  return {
    id: "test-1",
    name: "adds numbers",
    module: mockTestModule(),
    result: () => ({ state: "passed" as const }),
    diagnostic: () => ({ duration: 42 }),
    ...overrides,
  };
}

describe("TeamCityReporter", () => {
  let reporter: TeamCityReporter;
  let output: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    reporter = new TeamCityReporter();
    reporter.onInit({ config: { root: "/project" } } as any);
    output = [];
    originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => {
      output.push(String(chunk));
      return true;
    }) as any;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  describe("module lifecycle", () => {
    it("emits testSuiteStarted with relative path on module start", () => {
      reporter.onTestModuleStart(mockTestModule() as any);
      expect(output[0]).toContain("##teamcity[testSuiteStarted name='src/math.test.ts'");
    });

    it("emits testSuiteFinished on module end", () => {
      reporter.onTestModuleEnd(mockTestModule() as any);
      expect(output[0]).toContain("##teamcity[testSuiteFinished name='src/math.test.ts'");
    });

    it("includes flowId from moduleId", () => {
      reporter.onTestModuleStart(mockTestModule() as any);
      expect(output[0]).toContain("flowId='/project/src/math.test.ts'");
    });
  });

  describe("suite lifecycle", () => {
    it("emits testSuiteStarted on suite ready", () => {
      reporter.onTestSuiteReady(mockTestSuite() as any);
      expect(output[0]).toContain("##teamcity[testSuiteStarted name='addition'");
    });

    it("emits testSuiteFinished on suite result", () => {
      reporter.onTestSuiteReady(mockTestSuite() as any);
      reporter.onTestSuiteResult(mockTestSuite() as any);
      expect(output[1]).toContain("##teamcity[testSuiteFinished name='addition'");
    });

    it("suppresses skipped suites", () => {
      const suite = mockTestSuite({ options: { mode: "skip" } });
      reporter.onTestSuiteReady(suite as any);
      expect(output).toHaveLength(0);
    });

    it("suppresses todo suites", () => {
      const suite = mockTestSuite({ options: { mode: "todo" } });
      reporter.onTestSuiteReady(suite as any);
      expect(output).toHaveLength(0);
    });

    it("does not emit testSuiteFinished for suppressed suites", () => {
      const suite = mockTestSuite({ options: { mode: "skip" } });
      reporter.onTestSuiteReady(suite as any);
      reporter.onTestSuiteResult(suite as any);
      expect(output).toHaveLength(0);
    });
  });

  describe("test case - passed", () => {
    it("emits testStarted on ready", () => {
      reporter.onTestCaseReady(mockTestCase() as any);
      expect(output[0]).toContain("##teamcity[testStarted name='adds numbers'");
    });

    it("emits testFinished with duration on result", () => {
      reporter.onTestCaseReady(mockTestCase() as any);
      reporter.onTestCaseResult(mockTestCase() as any);
      expect(output[1]).toContain("##teamcity[testFinished name='adds numbers'");
      expect(output[1]).toContain("duration='42'");
    });
  });

  describe("test case - skipped", () => {
    it("does not emit testStarted for skipped tests", () => {
      const tc = mockTestCase({ result: () => ({ state: "skipped" }) });
      reporter.onTestCaseReady(tc as any);
      expect(output).toHaveLength(0);
    });

    it("emits testIgnored for skipped tests", () => {
      const tc = mockTestCase({ result: () => ({ state: "skipped" }) });
      reporter.onTestCaseResult(tc as any);
      expect(output[0]).toContain("##teamcity[testIgnored name='adds numbers'");
    });
  });

  describe("test case - failed", () => {
    it("emits testFailed then testFinished", () => {
      const tc = mockTestCase({
        result: () => ({
          state: "failed",
          errors: [{ message: "Expected 3 to be 4", stack: "Error: ...\n  at ..." }],
        }),
      });
      reporter.onTestCaseReady(tc as any);
      reporter.onTestCaseResult(tc as any);
      expect(output[1]).toContain("##teamcity[testFailed name='adds numbers'");
      expect(output[1]).toContain("message='Expected 3 to be 4'");
      expect(output[2]).toContain("##teamcity[testFinished name='adds numbers'");
    });

    it("reports comparison failures with expected/actual", () => {
      const tc = mockTestCase({
        result: () => ({
          state: "failed",
          errors: [{ message: "expected 3 to be 4", stack: "", expected: "4", actual: "3" }],
        }),
      });
      reporter.onTestCaseReady(tc as any);
      reporter.onTestCaseResult(tc as any);
      expect(output[1]).toContain("type='comparisonFailure'");
      expect(output[1]).toContain("expected='4'");
      expect(output[1]).toContain("actual='3'");
    });

    it("reports all errors, not just the first", () => {
      const tc = mockTestCase({
        result: () => ({
          state: "failed",
          errors: [
            { message: "first failure", stack: "stack1" },
            { message: "second failure", stack: "stack2" },
          ],
        }),
      });
      reporter.onTestCaseReady(tc as any);
      reporter.onTestCaseResult(tc as any);
      expect(output[1]).toContain("message='first failure || second failure'");
      expect(output[1]).toContain("stack1|n---|nstack2");
    });
  });

  describe("hook failure resilience", () => {
    it("emits testStarted retroactively if onTestCaseReady was missed", () => {
      const tc = mockTestCase({
        id: "missed-test",
        result: () => ({
          state: "failed",
          errors: [{ message: "beforeAll failed", stack: "" }],
        }),
      });
      reporter.onTestCaseResult(tc as any);
      expect(output[0]).toContain("##teamcity[testStarted name='adds numbers'");
      expect(output[1]).toContain("##teamcity[testFailed name='adds numbers'");
      expect(output[2]).toContain("##teamcity[testFinished name='adds numbers'");
    });
  });

  describe("console log capture", () => {
    it("emits testStdOut for captured stdout", () => {
      const tc = mockTestCase({ id: "log-test" });
      reporter.onUserConsoleLog({ content: "hello", type: "stdout", taskId: "log-test" });
      reporter.onUserConsoleLog({ content: "world", type: "stdout", taskId: "log-test" });
      reporter.onTestCaseReady(tc as any);
      reporter.onTestCaseResult(tc as any);
      const stdoutMsg = output.find((o) => o.includes("testStdOut"));
      expect(stdoutMsg).toContain("out='hello|nworld'");
    });

    it("emits testStdErr for captured stderr", () => {
      const tc = mockTestCase({ id: "err-test" });
      reporter.onUserConsoleLog({ content: "oops", type: "stderr", taskId: "err-test" });
      reporter.onTestCaseReady(tc as any);
      reporter.onTestCaseResult(tc as any);
      const stderrMsg = output.find((o) => o.includes("testStdErr"));
      expect(stderrMsg).toContain("out='oops'");
    });

    it("ignores console logs without a taskId", () => {
      reporter.onUserConsoleLog({ content: "orphan", type: "stdout" });
      expect(output).toHaveLength(0);
    });
  });

  describe("escaping in output", () => {
    it("escapes special characters in test names", () => {
      const tc = mockTestCase({ name: "it's [working]\nnow" });
      reporter.onTestCaseReady(tc as any);
      expect(output[0]).toContain("name='it|'s |[working|]|nnow'");
    });
  });
});
