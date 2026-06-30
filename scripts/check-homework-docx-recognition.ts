import { readFileSync } from "node:fs";
import { extractHomeworkTextFromFile, recognizeHomeworkStructure } from "../src/lib/homework-recognition";

async function main() {
  const questionPath = process.env.HOMEWORK_QUESTION_DOCX || "/Users/liwenhao/Downloads/测试题目.docx";
  const answerPath = process.env.HOMEWORK_ANSWER_DOCX || "/Users/liwenhao/Downloads/测试答案.docx";
  const questionBuffer = readFileSync(questionPath);
  const answerBuffer = readFileSync(answerPath);

  const questionFile = new File([questionBuffer], "测试题目.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const answerFile = new File([answerBuffer], "测试答案.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const questionText = await extractHomeworkTextFromFile(questionFile);
  const answerText = await extractHomeworkTextFromFile(answerFile);
  const result = recognizeHomeworkStructure({
    questionFileName: questionFile.name,
    answerFileName: answerFile.name,
    questionText,
    answerText,
  });

  if (result.questions.length < 20) {
    throw new Error(`Expected at least 20 questions, got ${result.questions.length}`);
  }
  if (result.questions[0]?.number !== "1") {
    throw new Error(`Expected first question number 1, got ${result.questions[0]?.number}`);
  }
  if (!result.questions[0]?.standardAnswer.includes("A")) {
    throw new Error(`Expected first answer to include A, got ${result.questions[0]?.standardAnswer}`);
  }
  if (!result.questions.some((question) => question.type === "解答")) {
    throw new Error("Expected at least one 解答 question");
  }

  console.log(`DOCX homework recognition check passed with ${result.questions.length} questions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
