import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(file, snippet, label) {
  if (!file.includes(snippet)) {
    throw new Error(`Missing ${label}`);
  }
}

const accountManager = read("src/app/accounts/account-manager.tsx");
const accountsApi = read("src/app/api/accounts/route.ts");
const learningLinksApi = read("src/app/api/learning-links/route.ts");
const accountsPage = read("src/app/accounts/page.tsx");
const manual = read("docs/操作手册.md");
const summary = read("docs/conversation-summary.md");

assertIncludes(accountsApi, "export async function DELETE", "account delete API");
assertIncludes(accountsApi, "cannot delete current account", "current account delete guard");
assertIncludes(accountsApi, "prisma.user.delete", "account delete operation");
assertIncludes(accountManager, "deleteAccount", "account delete handler");
assertIncludes(accountManager, "删除账号", "account delete button");
assertIncludes(accountManager, "不能删除当前登录账号", "current account delete UI guard");
assertIncludes(accountManager, "filteredLinkStudents", "learning link students filtered by selected parent");
assertIncludes(accountManager, "filteredLinkCourses", "learning link courses filtered by selected student");
assertIncludes(accountManager, "学习关系决定家长端和小程序", "learning link explanation copy");
assertIncludes(accountsPage, "studentCourses", "accounts page loads course student membership");
assertIncludes(accountsPage, "parentStudentIds", "accounts page exposes parent visible students");
assertIncludes(learningLinksApi, "student is not visible to this parent", "learning link API enforces parent visible student");
assertIncludes(learningLinksApi, "student is not in this course", "learning link API enforces course membership");
assertIncludes(manual, "编辑账号时可以删除账号", "operation manual account delete rule");
assertIncludes(manual, "学习关系不是登录账号本身", "operation manual learning link explanation");
assertIncludes(summary, "账号编辑支持删除账号", "conversation summary account delete update");
assertIncludes(summary, "学习关系下拉框会联动过滤", "conversation summary learning link filter update");

console.log("admin account delete and learning-link filter checks passed");
