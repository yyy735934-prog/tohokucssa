import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import {
  getChatGPTUser,
  requireChatGPTUser,
  type ChatGPTUser,
} from "../app/chatgpt-auth";
import {
  publicMemberName,
  type PublicNameMode,
} from "./public-identity";

export type MemberAccess = {
  email: string;
  displayName: string;
  publicName: string;
  publicNameMode: PublicNameMode;
  publicNickname: string | null;
  isAdmin: boolean;
  academicStatus: "verified" | "pending" | "rejected";
  profileCompleted: boolean;
};

const ACADEMIC_DOMAIN_SUFFIXES = [
  ".ac.jp",
  ".edu",
  ".edu.cn",
  ".ac.uk",
  ".edu.au",
  ".ac.kr",
];

async function configuredAdminEmails() {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as Record<string, unknown>;
  const value = typeof runtimeEnv.ADMIN_EMAILS === "string" ? runtimeEnv.ADMIN_EMAILS : "";
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAcademicEmail(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return ACADEMIC_DOMAIN_SUFFIXES.some(
    (suffix) => domain === suffix.slice(1) || domain.endsWith(suffix),
  );
}

export async function isAdminEmail(email: string) {
  return (await configuredAdminEmails()).has(email.trim().toLowerCase());
}

async function upsertMember(user: ChatGPTUser): Promise<MemberAccess> {
  const db = await getDb();
  const admin = await isAdminEmail(user.email);
  const autoStatus = admin || isAcademicEmail(user.email) ? "verified" : "pending";
  const existing = await db
    .select({
      academicStatus: users.academicStatus,
      profileCompleted: users.profileCompleted,
      publicNameMode: users.publicNameMode,
      publicNickname: users.publicNickname,
    })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);
  const academicStatus =
    existing[0]?.academicStatus === "verified" || existing[0]?.academicStatus === "rejected"
      ? existing[0].academicStatus
      : autoStatus;
  const publicNameMode = existing[0]?.publicNameMode === "nickname" ? "nickname" : "anonymous";
  const publicNickname = existing[0]?.publicNickname ?? null;

  await db
    .insert(users)
    .values({
      email: user.email,
      displayName: user.displayName,
      role: admin ? "admin" : "member",
      academicStatus,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        displayName: user.displayName,
        role: admin ? "admin" : "member",
        academicStatus: admin ? "verified" : academicStatus,
        lastSeenAt: new Date().toISOString(),
      },
    });

  return {
    email: user.email,
    displayName: user.displayName,
    publicName: publicMemberName(publicNameMode, publicNickname),
    publicNameMode,
    publicNickname,
    isAdmin: admin,
    academicStatus: academicStatus as MemberAccess["academicStatus"],
    profileCompleted: Boolean(existing[0]?.profileCompleted),
  };
}

export async function getMemberAccess() {
  const user = await getChatGPTUser();
  return user ? upsertMember(user) : null;
}

export async function requireMemberAccess(returnTo: string) {
  const user = await requireChatGPTUser(returnTo);
  return upsertMember(user);
}

export async function requireAdminAccess(returnTo: string) {
  const member = await requireMemberAccess(returnTo);
  return member.isAdmin ? member : null;
}

export async function getAdminAccess() {
  const member = await getMemberAccess();
  return member?.isAdmin ? member : null;
}
