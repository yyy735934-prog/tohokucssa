const LOGIN_CODE_LENGTH = 6;

export function normalizeLoginEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidLoginEmail(email: string) {
  if (!email || email.length > 254) return false;
  const [local, domain, ...extra] = email.split("@");
  return (
    extra.length === 0 &&
    Boolean(local) &&
    local.length <= 64 &&
    Boolean(domain) &&
    domain.includes(".") &&
    !/\s/.test(email)
  );
}

export function createEmailLoginCode() {
  const range = 10 ** LOGIN_CODE_LENGTH;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return String(values[0] % range).padStart(LOGIN_CODE_LENGTH, "0");
}

export async function hashEmailLoginCode(
  secret: string,
  email: string,
  code: string,
) {
  return hmacHex(secret, `${normalizeLoginEmail(email)}:${code}`);
}

export async function hashEmailLoginRateLimitKey(
  secret: string,
  value: string,
) {
  return hmacHex(secret, `email-login-rate-limit:${value}`);
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function constantTimeTextEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function displayNameFromEmail(email: string) {
  const local = normalizeLoginEmail(email).split("@")[0] ?? "学友";
  const readable = local.replace(/[._+-]+/g, " ").trim();
  return readable.slice(0, 40) || "学友";
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
