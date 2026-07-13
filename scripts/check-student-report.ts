import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportModulePath = path.join(root, "src/lib/student-report.ts");
const reportsPagePath = path.join(root, "src/app/reports/page.tsx");
const reportClientPath = path.join(root, "src/components/student-report-selector.tsx");
const printPagePath = path.join(root, "src/app/reports/students/[id]/page.tsx");
const printButtonPath = path.join(root, "src/components/student-report-print-button.tsx");
const appShellPath = path.join(root, "src/components/app-shell.tsx");
const sidebarPath = path.join(root, "src/components/sidebar.tsx");

async function main() {
  assert.ok(existsSync(reportModulePath), "student report data module should exist");
  assert.ok(existsSync(reportClientPath), "reports page should have a client-side selector");
  assert.ok(existsSync(printPagePath), "student print report page should exist");
  assert.ok(existsSync(printButtonPath), "student report should have a print button client component");

  const reportModule = await import("../src/lib/student-report");
  const {
    buildReportDateRange,
    isDateInReportRange,
    normalizeReportVersion,
  } = reportModule;

  assert.equal(normalizeReportVersion("internal"), "internal", "internal report version should be preserved");
  assert.equal(normalizeReportVersion("unexpected"), "parent", "unknown report version should fall back to parent");

  const boundedRange = buildReportDateRange("2026-03-02", "2026-03-05");
  assert.equal(boundedRange.label, "2026-03-02 至 2026-03-05", "bounded date range should have a printable label");
  assert.equal(boundedRange.from?.toISOString(), "2026-03-02T00:00:00.000Z", "from should include the whole first day");
  assert.equal(boundedRange.toExclusive?.toISOString(), "2026-03-06T00:00:00.000Z", "to should include the whole last day");
  assert.equal(isDateInReportRange(new Date("2026-03-05T23:59:59.000Z"), boundedRange), true, "last-day records should be included");
  assert.equal(isDateInReportRange(new Date("2026-03-06T00:00:00.000Z"), boundedRange), false, "records after the range should be excluded");

  const allHistory = buildReportDateRange(undefined, undefined);
  assert.equal(allHistory.label, "全部历史", "empty dates should represent all history");
  assert.equal(isDateInReportRange(new Date("2000-01-01"), allHistory), true, "all-history range should include old records");
  assert.equal(buildReportDateRange("2026-03-05", "2026-03-02").label, "2026-03-02 至 2026-03-05", "reversed URL dates should be normalized safely");

  const reportsPage = readFileSync(reportsPagePath, "utf8");
  const reportModuleSource = readFileSync(reportModulePath, "utf8");
  const reportClient = readFileSync(reportClientPath, "utf8");
  const printPage = readFileSync(printPagePath, "utf8");
  const printButton = readFileSync(printButtonPath, "utf8");
  const appShell = readFileSync(appShellPath, "utf8");
  const sidebar = readFileSync(sidebarPath, "utf8");

  assert.match(reportsPage, /getStudentReportOptions/, "reports page should load only visible student options through the shared module");
  assert.match(reportModuleSource, /reportCourseScope\(user, student\.id, allowLegacy\)/, "course and homework data should be scoped to the selected student and teacher");
  assert.match(reportModuleSource, /learningLinks:\s*\{\s*none:\s*\{\s*workspaceId:\s*user\.workspaceId,\s*studentId/, "legacy course fallback should apply only when the student has no course learning link");
  assert.match(reportModuleSource, /currentVersion:\s*\{\s*is:\s*\{\s*submittedAt: rangeWhere/, "homework date filtering should use the current submission time");
  assert.match(reportModuleSource, /filter\(\(exam\) => exam\.totalScore > 0\)/, "invalid exam totals should not lower the average score rate");
  assert.match(reportClient, /version/, "selector should support parent and internal report versions");
  assert.match(reportClient, /from/, "selector should support a start date");
  assert.match(reportClient, /to/, "selector should support an end date");
  assert.match(reportClient, /from && to && from > to/, "selector should reject a reversed date range");
  assert.match(printPage, /getStudentReport/, "print page should use the shared report data assembler");
  assert.match(printPage, /@media print/, "print page should define print-specific layout rules");
  assert.doesNotMatch(printPage, /aside,\s*header/, "print styles should not hide the report's own header");
  assert.match(printPage, /internal/, "print page should render internal-only content conditionally");
  assert.match(printButton, /window\.print\(\)/, "PDF export should use the browser print dialog");
  assert.match(appShell, /pathname\.startsWith\("\/reports\/students\/"\)/, "print preview should use the full-screen app layout");
  assert.match(sidebar, /pathname\.startsWith\("\/reports\/students\/"\)/, "print preview should hide the sidebar");

  console.log("student report regression checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
