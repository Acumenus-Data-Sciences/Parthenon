// Use crypto.randomUUID when available (browser + Node 19+). Fall back to a
// v4-ish implementation for older runtimes (only realistic case is tests on
// pre-19 Node with a mocked crypto).
export function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback — Math.random is fine here; the uniqueness is
  // per-user+window not cryptographic.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
