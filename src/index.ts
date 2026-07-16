import type { Reporter, TestCase, TestModule, TestSuite, Vitest } from "vitest/node";
import { relative } from "node:path";

// oxlint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;

export function escapeValue(str: string): string {
  return str
    .replace(ANSI_RE, "")
    .replace(/\|/g, "||")
    .replace(/'/g, "|'")
    .replace(/\n/g, "|n")
    .replace(/\r/g, "|r")
    .replace(/\u0085/g, "|0x0085")
    .replace(/\u2028/g, "|0x2028")
    .replace(/\u2029/g, "|0x2029")
    .replace(/\[/g, "|[")
    .replace(/\]/g, "|]");
}

export function formatMessage(messageName: string, attrs: Record<string, string | number>): string {
  const parts = Object.entries(attrs)
    .map(([k, v]) => `${k}='${escapeValue(String(v))}'`)
    .join(" ");
  return `##teamcity[${messageName} ${parts}]`;
}

interface ConsoleEntry {
  stdout: string[];
  stderr: string[];
}

export default class TeamCityReporter implements Reporter {
  private root = process.cwd();
  private startedTests = new Set<string>();
  private startedSuites = new Set<string>();
  private consoleLogs = new Map<string, ConsoleEntry>();

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
  }

  private emit(messageName: string, attrs: Record<string, string | number>) {
    process.stdout.write(formatMessage(messageName, attrs) + "\n");
  }

  private moduleName(testModule: TestModule): string {
    return relative(this.root, testModule.moduleId) || testModule.moduleId;
  }

  onUserConsoleLog(log: { content: string; type: "stdout" | "stderr"; taskId?: string }) {
    if (!log.taskId) return;
    let entry = this.consoleLogs.get(log.taskId);
    if (!entry) {
      entry = { stdout: [], stderr: [] };
      this.consoleLogs.set(log.taskId, entry);
    }
    entry[log.type].push(log.content);
  }

  onTestModuleStart(testModule: TestModule) {
    this.emit("testSuiteStarted", {
      name: this.moduleName(testModule),
      flowId: testModule.moduleId,
    });
  }

  onTestModuleEnd(testModule: TestModule) {
    this.emit("testSuiteFinished", {
      name: this.moduleName(testModule),
      flowId: testModule.moduleId,
    });
  }

  onTestSuiteReady(testSuite: TestSuite) {
    const mode = testSuite.options.mode;
    if (mode === "skip" || mode === "todo") return;
    this.startedSuites.add(testSuite.id);
    this.emit("testSuiteStarted", {
      name: testSuite.name,
      flowId: testSuite.module.moduleId,
    });
  }

  onTestSuiteResult(testSuite: TestSuite) {
    if (!this.startedSuites.delete(testSuite.id)) return;
    this.emit("testSuiteFinished", {
      name: testSuite.name,
      flowId: testSuite.module.moduleId,
    });
  }

  onTestCaseReady(testCase: TestCase) {
    if (testCase.result().state === "skipped") return;
    this.startedTests.add(testCase.id);
    this.emit("testStarted", {
      name: testCase.name,
      flowId: testCase.module.moduleId,
    });
  }

  onTestCaseResult(testCase: TestCase) {
    const result = testCase.result();
    const flowId = testCase.module.moduleId;

    if (result.state === "skipped") {
      this.emit("testIgnored", {
        name: testCase.name,
        flowId,
        message: "",
      });
      return;
    }

    if (!this.startedTests.delete(testCase.id)) {
      this.emit("testStarted", {
        name: testCase.name,
        flowId,
      });
    }

    const logs = this.consoleLogs.get(testCase.id);
    if (logs) {
      if (logs.stdout.length) {
        this.emit("testStdOut", { name: testCase.name, flowId, out: logs.stdout.join("\n") });
      }
      if (logs.stderr.length) {
        this.emit("testStdErr", { name: testCase.name, flowId, out: logs.stderr.join("\n") });
      }
      this.consoleLogs.delete(testCase.id);
    }

    if (result.state === "failed" && result.errors.length) {
      const message = result.errors.map((e) => e.message || "Test failed").join(" | ");
      const details = result.errors
        .map((e) => e.stack || "")
        .filter(Boolean)
        .join("\n---\n");
      const attrs: Record<string, string | number> = {
        name: testCase.name,
        flowId,
        message,
        details,
      };

      const first = result.errors[0];
      if ("expected" in first && "actual" in first) {
        attrs.type = "comparisonFailure";
        attrs.expected = String((first as Record<string, unknown>).expected);
        attrs.actual = String((first as Record<string, unknown>).actual);
      }

      this.emit("testFailed", attrs);
    }

    const duration = testCase.diagnostic()?.duration ?? 0;
    this.emit("testFinished", {
      name: testCase.name,
      flowId,
      duration: Math.round(duration),
    });
  }
}

export { TeamCityReporter };
