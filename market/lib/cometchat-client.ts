"use client";

type ChatSession = { appId: string; region: string; uid: string; authToken: string };
let initializedFor = "";

export function describeCometChatError(reason: unknown) {
  if (reason instanceof Error) return { code: reason.name || "Error", message: reason.message };
  if (reason && typeof reason === "object") {
    const value = reason as { code?: unknown; name?: unknown; message?: unknown };
    return {
      code: typeof value.code === "string" ? value.code : typeof value.name === "string" ? value.name : "COMETCHAT_ERROR",
      message: typeof value.message === "string" ? value.message : "CometChat request failed",
    };
  }
  return { code: "COMETCHAT_ERROR", message: String(reason || "CometChat request failed") };
}

function isNotLoggedIn(reason: unknown) {
  const detail = describeCometChatError(reason);
  return /USER_NOT_LOG(?:G)?ED_IN|NOT_LOGGED_IN/i.test(detail.code);
}

export async function ensureCometChatSession() {
  const response = await fetch("/api/chat/session", { cache: "no-store" });
  const session = await response.json() as ChatSession & { error?: string };
  if (!response.ok) throw new Error(session.error || "聊天服务暂时不可用。");
  const { CometChat } = await import("@cometchat/chat-sdk-javascript");
  const key = `${session.appId}:${session.region}`;
  if (initializedFor !== key) {
    const settings = new CometChat.AppSettingsBuilder().setRegion(session.region).autoEstablishSocketConnection(true).build();
    await CometChat.init(session.appId, settings);
    initializedFor = key;
  }
  let loggedIn = null;
  try {
    loggedIn = await CometChat.getLoggedInUser();
  } catch (reason) {
    // CometChat v4 throws on a clean browser profile instead of returning null.
    // That state is expected immediately before the first auth-token login.
    if (!isNotLoggedIn(reason)) throw reason;
  }
  if (loggedIn?.getUid?.() !== session.uid) {
    if (loggedIn) await CometChat.logout();
    await CometChat.login(session.authToken);
  }
  return { CometChat, session };
}
