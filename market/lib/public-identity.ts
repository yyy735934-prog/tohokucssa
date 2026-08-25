export type PublicNameMode = "anonymous" | "nickname";

export const ANONYMOUS_SELLER_NAME = "匿名卖家";

export function normalizePublicNameMode(value: unknown): PublicNameMode | null {
  return value === "anonymous" || value === "nickname" ? value : null;
}

export function normalizePublicNickname(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 20);
}

export function isValidPublicNickname(value: string) {
  return /^[\p{L}\p{N}_·・\- ]{2,20}$/u.test(value);
}

export function publicMemberName(
  mode: unknown,
  nickname: unknown,
) {
  const normalizedNickname = normalizePublicNickname(nickname);
  return mode === "nickname" && isValidPublicNickname(normalizedNickname)
    ? normalizedNickname
    : ANONYMOUS_SELLER_NAME;
}
