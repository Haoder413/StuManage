import assert from "node:assert/strict";
import test from "node:test";
import { suggestResourceNames, validateFileNameBatch } from "./deepseek-resource-naming";

test("validates filename-only analysis batches", () => {
  assert.deepEqual(validateFileNameBatch(["试卷.pdf", "答案.pdf"]), ["试卷.pdf", "答案.pdf"]);
  assert.throws(() => validateFileNameBatch([]), /empty_file_names/);
  assert.throws(() => validateFileNameBatch(Array.from({ length: 51 }, (_, index) => `${index}.pdf`)), /too_many_file_names/);
  assert.throws(() => validateFileNameBatch(["x".repeat(256)]), /file_name_too_long/);
});

test("falls back to local filename analysis when no API key is configured", async () => {
  const result = await suggestResourceNames(["初二数学函数试卷.pdf"], { apiKey: "" });

  assert.equal(result.source, "local");
  assert.equal(result.groups[0].subject, "数学");
});

test("uses a validated DeepSeek JSON result without sending file content", async () => {
  let body = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    body = String(init?.body || "");
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            groups: [{
              groupKey: "初二数学函数试卷",
              title: "初二数学｜函数专题试卷",
              grade: "初二",
              subject: "数学",
              resourceKind: "paper",
              tags: ["函数", "专题"],
              confidence: 0.91,
              needsConfirmation: false,
              reason: "文件名信息完整",
              files: [{ originalName: "初二数学函数试卷.pdf", role: "student" }],
            }],
          }),
        },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await suggestResourceNames(["初二数学函数试卷.pdf"], {
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(result.source, "deepseek");
  assert.equal(result.groups[0].title, "初二数学｜函数专题试卷");
  assert.match(body, /初二数学函数试卷\.pdf/);
  assert.doesNotMatch(body, /fileContent|base64|data:/);
});

test("falls back when DeepSeek returns malformed data", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "{}" } }],
  }), { status: 200 });

  const result = await suggestResourceNames(["初三数学期中试卷.pdf"], {
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(result.source, "local");
});

test("keeps low-confidence AI pairings as separate groups", async () => {
  const names = ["练习A.pdf", "练习B答案.pdf"];
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ groups: [{
      groupKey: "练习",
      title: "练习",
      grade: null,
      subject: null,
      resourceKind: "paper",
      tags: [],
      confidence: 0.62,
      needsConfirmation: true,
      reason: "可能配套",
      files: [
        { originalName: names[0], role: "student" },
        { originalName: names[1], role: "answer" },
      ],
    }] }) } }],
  }), { status: 200 });

  const result = await suggestResourceNames(names, { apiKey: "test-key", fetchImpl });

  assert.equal(result.groups.length, 2);
  assert.ok(result.groups.every((group) => group.needsConfirmation));
});
