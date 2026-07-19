const YEAR_ERROR = "请输入 1900—2100 的年份";

function parseMiniYearInput(input, currentYear) {
  const value = String(input || "").trim();
  if (value) {
    const year = Number(value);
    if (!/^\d{4}$/.test(value) || year < 1900 || year > 2100) {
      return { year: currentYear, yearInput: value, error: YEAR_ERROR, changed: false };
    }
  }
  return { year: value, yearInput: value, error: "", changed: value !== currentYear };
}

function toggleMiniUnsetYear(currentYear) {
  return { year: currentYear === "unset" ? "" : "unset", yearInput: "" };
}

module.exports = { parseMiniYearInput, toggleMiniUnsetYear };
