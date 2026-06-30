import { inflateRawSync } from "node:zlib";

export type HomeworkRecognizedQuestion = {
  number: string;
  type: string;
  score: number;
  standardAnswer: string;
  explanation: string;
  orderIndex: number;
};

export type HomeworkRecognitionResult = {
  provider: "local_rules";
  status: "completed" | "needs_review";
  questions: HomeworkRecognizedQuestion[];
  notes: string[];
};

const questionNumberPattern = /(?:^|\n)\s*(?:第?\s*)?([0-9]{1,3})\s*[\.．、)](?!\d)/g;

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function findZipEntry(buffer: Buffer, entryName: string) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (fileName === entryName) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressedData;
      if (compressionMethod === 8) return inflateRawSync(compressedData);
      return null;
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function extractDocxText(buffer: Buffer) {
  const documentXml = findZipEntry(buffer, "word/document.xml");
  if (!documentXml) return "";

  return decodeXmlEntities(
    documentXml
      .toString("utf8")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractHomeworkTextFromBuffer(fileName: string, buffer: Buffer) {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".docx")) return "";
  return extractDocxText(buffer);
}

export async function extractHomeworkTextFromFile(file: File) {
  return extractHomeworkTextFromBuffer(file.name, Buffer.from(await file.arrayBuffer()));
}

function inferQuestionType(text: string) {
  if (/选择|A[.、]|B[.、]|C[.、]|D[.、]/.test(text)) return "选择";
  if (/填空|____|_{3,}/.test(text)) return "填空";
  if (/计算|化简|求值/.test(text)) return "计算";
  if (/解答|证明|说明理由/.test(text)) return "解答";
  return "其他";
}

function splitAnswerBlocks(answerText: string) {
  const blocks = new Map<string, { answer: string; explanation: string }>();
  const matches = Array.from(answerText.matchAll(questionNumberPattern));
  if (matches.length === 0) return blocks;

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const next = matches[index + 1];
    const number = match[1];
    const start = match.index || 0;
    const end = next?.index || answerText.length;
    const block = answerText.slice(start, end).trim();
    const [answerPart, explanationPart = ""] = block.split(/【分析】|解析[:：]/);
    const answerValue = answerPart
      .replace(questionNumberPattern, "")
      .replace(/答案[:：]/, "")
      .split(/\n|【/)[0]
      .trim();
    blocks.set(number, {
      answer: answerValue,
      explanation: explanationPart.trim(),
    });
  }

  return blocks;
}

export function recognizeHomeworkStructure(params: {
  questionFileName: string;
  answerFileName: string;
  questionText?: string;
  answerText?: string;
}): HomeworkRecognitionResult {
  const questionText = params.questionText || "";
  const answerText = params.answerText || "";
  const answerBlocks = splitAnswerBlocks(answerText);
  const matches = Array.from(questionText.matchAll(questionNumberPattern));

  if (matches.length === 0) {
    return {
      provider: "local_rules",
      status: "needs_review",
      questions: [
        {
          number: "1",
          type: "其他",
          score: 0,
          standardAnswer: "",
          explanation: "",
          orderIndex: 0,
        },
      ],
      notes: [
        `未能从 ${params.questionFileName} 自动识别题号，已创建 1 道占位题，请老师手动核对。`,
        `答案文件 ${params.answerFileName} 已保存，可在核对页补充标准答案和解析。`,
      ],
    };
  }

  const questions = matches.map((match, index) => {
    const next = matches[index + 1];
    const number = match[1];
    const start = match.index || 0;
    const end = next?.index || questionText.length;
    const block = questionText.slice(start, end);
    const answerBlock = answerBlocks.get(number);
    return {
      number,
      type: inferQuestionType(block),
      score: 0,
      standardAnswer: answerBlock?.answer || "",
      explanation: answerBlock?.explanation || "",
      orderIndex: index,
    };
  });

  return {
    provider: "local_rules",
    status: "completed",
    questions,
    notes: [`本地规则从题目文本中识别出 ${questions.length} 道题。`],
  };
}
