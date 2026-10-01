export const LISTING_MODERATION_ACTIONS = [
  "active",
  "rejected",
  "sold",
  "withdrawn",
] as const;

export const USER_MODERATION_ACTIONS = [
  "verified",
  "member",
  "rejected",
  "pending",
] as const;

export const APPEAL_MODERATION_ACTIONS = ["verified", "rejected"] as const;

export function isListingModerationAction(value: unknown): value is string {
  return LISTING_MODERATION_ACTIONS.includes(
    value as (typeof LISTING_MODERATION_ACTIONS)[number],
  );
}

export function isAppealModerationAction(value: unknown): value is string {
  return APPEAL_MODERATION_ACTIONS.includes(
    value as (typeof APPEAL_MODERATION_ACTIONS)[number],
  );
}

export function isUserModerationAction(value: unknown): value is string {
  return USER_MODERATION_ACTIONS.includes(
    value as (typeof USER_MODERATION_ACTIONS)[number],
  );
}

export function shouldShowUserModerationActions(
  role: string,
  academicStatus: string,
) {
  return role !== "admin" && academicStatus === "pending";
}
