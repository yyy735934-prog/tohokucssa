"use client";

type ChatSession = { appId: string; region: string; uid: string; authToken: string };
let initializedFor = "";

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
  const loggedIn = await CometChat.getLoggedInUser();
  if (loggedIn?.getUid?.() !== session.uid) {
    if (loggedIn) await CometChat.logout();
    await CometChat.login(session.authToken);
  }
  return { CometChat, session };
}
