import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  commitStagedResourceFile,
  cloneStoredResourceFile,
  getStoredResourcePath,
  hashResourceBytes,
  removeStoredResourceFile,
  removeStagedResourceFile,
  stageUploadedResourceFile,
} from "./resource-storage";

test("computes stable SHA-256 hashes", () => {
  assert.equal(
    hashResourceBytes(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("stages and commits a resource file", async () => {
  const content = "%PDF-1.4\nresource-test";
  const file = new File([content], "试卷.pdf", { type: "application/pdf" });
  const staged = await stageUploadedResourceFile(file);

  assert.equal(staged.sha256, hashResourceBytes(Buffer.from(content)));
  await commitStagedResourceFile(staged);
  await access(getStoredResourcePath(staged.storedName));
  await removeStoredResourceFile(staged.storedName);
  await assert.rejects(() => access(getStoredResourcePath(staged.storedName)));
});

test("removes a staged file safely", async () => {
  const file = new File(["%PDF-1.4\nremove-test"], "答案.pdf", { type: "application/pdf" });
  const staged = await stageUploadedResourceFile(file);

  await removeStagedResourceFile(staged);
  await assert.rejects(() => access(staged.stagedPath));
});

test("clones a stored legacy file to an independent name", async () => {
  const staged = await stageUploadedResourceFile(new File(["%PDF-1.4\nclone-test"], "旧试卷.pdf", { type: "application/pdf" }));
  await commitStagedResourceFile(staged);
  const clonedName = await cloneStoredResourceFile(staged.storedName, ".pdf");
  assert.notEqual(clonedName, staged.storedName);
  await access(getStoredResourcePath(clonedName));
  await removeStoredResourceFile(staged.storedName);
  await access(getStoredResourcePath(clonedName));
  await removeStoredResourceFile(clonedName);
});

test("rejects a file whose content does not match its extension", async () => {
  const fakePdf = new File(["<html>not a pdf</html>"], "伪装试卷.pdf", { type: "application/pdf" });
  await assert.rejects(() => stageUploadedResourceFile(fakePdf), /resource_content_mismatch/);
});
