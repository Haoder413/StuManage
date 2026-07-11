import assert from "node:assert/strict";
import {
  buildEffectiveProgressStatuses,
  calculateAncestorProgressUpdates,
} from "../src/lib/knowledge-progress-tree";

const points = [
  { id: "chapter", parentId: null },
  { id: "topic", parentId: "chapter" },
  { id: "leaf-a", parentId: "topic" },
  { id: "leaf-b", parentId: "topic" },
];

assert.deepEqual(
  calculateAncestorProgressUpdates(points, { "leaf-a": "mastered", "leaf-b": "mastered" }, "leaf-b"),
  [
    { knowledgePointId: "topic", status: "mastered" },
    { knowledgePointId: "chapter", status: "mastered" },
  ],
  "all completed children should recursively complete every ancestor",
);

assert.deepEqual(
  calculateAncestorProgressUpdates(
    points,
    { chapter: "mastered", topic: "mastered", "leaf-a": "mastered", "leaf-b": "learning" },
    "leaf-b",
  ),
  [
    { knowledgePointId: "topic", status: "learning" },
    { knowledgePointId: "chapter", status: "learning" },
  ],
  "an incomplete child should recursively return every ancestor to learning",
);

console.log("Progress parent cascade checks passed.");

assert.deepEqual(
  buildEffectiveProgressStatuses(
    [
      { knowledgePointId: "leaf-a", status: "mastered", learningLinkId: null },
      { knowledgePointId: "leaf-b", status: "mastered", learningLinkId: null },
      { knowledgePointId: "leaf-b", status: "learning", learningLinkId: "current-link" },
    ],
    "current-link",
  ),
  { "leaf-a": "mastered", "leaf-b": "learning" },
  "current learning-link progress should override legacy progress while preserving legacy-only siblings",
);
