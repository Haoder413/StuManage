import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export const DUMMY_PASSWORD_HASH =
  "pbkdf2$100000$4d7f1c9a2b8e6d0f3a5c7e9b1d2f4a6c$668f11cc5539da2d605845f02650b90b3d99bc34fb058a198515e8386b4a2f3d";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsText, salt, expectedHash] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !expectedHash) return false;

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const actual = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyLoginPassword(
  password: string,
  user: { passwordHash: string } | null,
  verify: (password: string, storedHash: string) => boolean = verifyPassword,
): boolean {
  const matches = verify(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  return user !== null && matches;
}
