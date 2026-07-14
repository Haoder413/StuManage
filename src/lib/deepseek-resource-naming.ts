import {
  analyzeResourceFileNames,
  type ResourceAnalysisResult,
  validateAnalysisResult,
} from "@/lib/resource-filename-analysis";

type DeepSeekOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const SYSTEM_PROMPT = `你是中文教学资料文件名整理助手。你只能依据文件名判断，不得假设你看过文件内容。
返回 JSON 对象 {"groups": [...]}。每个文件必须且只能出现一次。
每个 group 必须包含 groupKey、title、grade、subject、resourceKind、tags、confidence、needsConfirmation、reason、files。
resourceKind 只能是 paper、animation、material；files 中每项只能包含 fileIndex 和 role，fileIndex 必须逐字使用用户提供的序号，role 只能是 student、answer、supplement。
只有名称主体明确相同且能确定为学生版与答案版时才能合并；无法确定时保持为两个独立 group，并设置 needsConfirmation=true。
title 使用简洁统一的中文资料名，不带扩展名和“答案版/学生版”等版本后缀。tags 最多 5 个。confidence 为 0 到 1。`;

export function validateFileNameBatch(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("empty_file_names");
  if (value.length > 50) throw new Error("too_many_file_names");
  const names = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) throw new Error("invalid_file_name");
    const name = item.trim();
    if (name.length > 255) throw new Error("file_name_too_long");
    if (name.includes("\0")) throw new Error("invalid_file_name");
    return name;
  });
  if (new Set(names).size !== names.length) throw new Error("duplicate_file_name");
  return names;
}

function requestBody(fileNames: string[], model: string) {
  return JSON.stringify({
    model,
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ files: fileNames.map((originalName, fileIndex) => ({ fileIndex, originalName })) }) },
    ],
  });
}

async function callDeepSeek(
  fileNames: string[],
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody(fileNames, model),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`deepseek_http_${response.status}`);
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("deepseek_empty_response");
    const validated = validateAnalysisResult(JSON.parse(content), fileNames);
    if (!validated) throw new Error("deepseek_invalid_response");
    const groups = validated.groups.flatMap((group) => {
      if (group.files.length === 1 || (group.confidence >= 0.9 && !group.needsConfirmation)) return [group];
      return group.files.map((file) => {
        const local = analyzeResourceFileNames([file.originalName]).groups[0];
        return {
          ...local,
          needsConfirmation: true,
          reason: "AI 认为可能配套，但置信度不足，已保持为独立资料",
        };
      });
    });
    return { source: "deepseek" as const, groups };
  } finally {
    clearTimeout(timeout);
  }
}

export async function suggestResourceNames(
  fileNames: string[],
  options: DeepSeekOptions = {}
): Promise<ResourceAnalysisResult> {
  const fallback = analyzeResourceFileNames(fileNames);
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  if (!apiKey || fileNames.length === 0) return fallback;

  const fetchImpl = options.fetchImpl || fetch;
  const model = options.model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const timeoutMs = options.timeoutMs || 12_000;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callDeepSeek(fileNames, apiKey, model, fetchImpl, timeoutMs);
    } catch (error) {
      lastError = error;
      // One limited retry keeps transient failures from interrupting uploads.
    }
  }
  if (!options.fetchImpl) {
    console.warn("[resource-ai] DeepSeek naming fallback", {
      error: lastError instanceof Error ? lastError.message : "unknown_error",
      fileCount: fileNames.length,
    });
  }
  return fallback;
}
