const ITERATIONS = 100_000;
const KEY_LEN = 256;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): ArrayBuffer {
  const bytes = (hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16));
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return buf;
}

export async function hashPin(pin: string): Promise<string> {
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const saltBuf = saltArr.buffer.slice(
    saltArr.byteOffset,
    saltArr.byteOffset + saltArr.byteLength
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LEN
  );
  return `pbkdf2:${toHex(saltBuf)}:${toHex(bits)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const saltBuf = fromHex(parts[1]);
  const expected = parts[2];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LEN
  );
  return toHex(bits) === expected;
}
