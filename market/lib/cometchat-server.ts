import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { chatConversations, chatIdentities, listings } from "../db/schema";

type ChatEnv = {
  COMETCHAT_APP_ID?: string;
  COMETCHAT_REGION?: string;
  COMETCHAT_REST_API_KEY?: string;
};

export type ChatConfiguration = Required<ChatEnv>;

export async function getChatConfiguration(): Promise<ChatConfiguration | null> {
  const { env } = await import("cloudflare:workers");
  const value = env as unknown as ChatEnv;
  const appId = value.COMETCHAT_APP_ID?.trim();
  const region = value.COMETCHAT_REGION?.trim().toLowerCase();
  const apiKey = value.COMETCHAT_REST_API_KEY?.trim();
  if (!appId || !region || !apiKey || !/^[a-z0-9-]+$/i.test(appId) || !/^[a-z0-9-]+$/i.test(region)) return null;
  return { COMETCHAT_APP_ID: appId, COMETCHAT_REGION: region, COMETCHAT_REST_API_KEY: apiKey };
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function providerUid(email: string) {
  return `u_${(await digest(`tohoku-market:user:${email.toLowerCase()}`)).slice(0, 30)}`;
}

async function publicAlias(email: string, attempt = 0) {
  const hex = await digest(`tohoku-market:alias:${email.toLowerCase()}:${attempt}`);
  return String((Number.parseInt(hex.slice(0, 12), 16) % 900000) + 100000);
}

async function cometChatRequest<T>(config: ChatConfiguration, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://${config.COMETCHAT_APP_ID}.api-${config.COMETCHAT_REGION}.cometchat.io/v3${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      apiKey: config.COMETCHAT_REST_API_KEY,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? data.error?.message : undefined;
    throw new Error(message || `COMETCHAT_${response.status}`);
  }
  return data as T;
}

type ProviderUserResponse = { data?: { uid?: string; authToken?: string }; uid?: string; authToken?: string };

export async function ensureChatIdentity(email: string, config: ChatConfiguration) {
  const db = await getDb();
  const existing = await db.select().from(chatIdentities).where(eq(chatIdentities.userEmail, email)).limit(1);
  if (existing[0]?.authToken) return existing[0];

  const uid = existing[0]?.providerUid ?? await providerUid(email);
  let alias = existing[0]?.publicAlias;
  if (!alias) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = await publicAlias(email, attempt);
      const collision = await db.select({ email: chatIdentities.userEmail }).from(chatIdentities).where(eq(chatIdentities.publicAlias, candidate)).limit(1);
      if (!collision[0] || collision[0].email === email) { alias = candidate; break; }
    }
  }
  if (!alias) throw new Error("CHAT_ALIAS_UNAVAILABLE");

  let authToken: string | undefined;
  if (!existing[0]) {
    try {
      const created = await cometChatRequest<ProviderUserResponse>(config, "/users", {
        method: "POST",
        body: JSON.stringify({ uid, name: `用户 ${alias}`, withAuthToken: true }),
      });
      authToken = created.data?.authToken ?? created.authToken;
    } catch (error) {
      if (!(error instanceof Error) || !/already|exist|duplicate|409/i.test(error.message)) throw error;
    }
  }
  if (!authToken) {
    const token = await cometChatRequest<ProviderUserResponse>(config, `/users/${encodeURIComponent(uid)}/auth_tokens`, {
      method: "POST",
      body: JSON.stringify({ force: true }),
    });
    authToken = token.data?.authToken ?? token.authToken;
  }
  if (!authToken) throw new Error("COMETCHAT_TOKEN_MISSING");

  await db.insert(chatIdentities).values({ userEmail: email, providerUid: uid, publicAlias: alias, authToken })
    .onConflictDoUpdate({ target: chatIdentities.userEmail, set: { providerUid: uid, publicAlias: alias, authToken, updatedAt: new Date().toISOString() } });
  return { userEmail: email, providerUid: uid, publicAlias: alias, authToken, createdAt: existing[0]?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function ensureListingConversation(listingId: string, buyerEmail: string, config: ChatConfiguration) {
  const db = await getDb();
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing || listing.status !== "active") throw new Error("LISTING_UNAVAILABLE");
  if (listing.ownerEmail === buyerEmail) throw new Error("SELF_CHAT");

  const prior = await db.select().from(chatConversations).where(and(
    eq(chatConversations.listingId, listing.id),
    eq(chatConversations.buyerEmail, buyerEmail),
    eq(chatConversations.sellerEmail, listing.ownerEmail),
  )).limit(1);
  if (prior[0]) return prior[0];

  const [buyer, seller] = await Promise.all([
    ensureChatIdentity(buyerEmail, config),
    ensureChatIdentity(listing.ownerEmail, config),
  ]);
  const id = crypto.randomUUID();
  const groupId = `tm_${(await digest(`${listing.id}:${buyer.providerUid}:${seller.providerUid}`)).slice(0, 32)}`;

  try {
    await cometChatRequest(config, "/groups", {
      method: "POST",
      body: JSON.stringify({ guid: groupId, name: "匿名交易会话", type: "private", owner: seller.providerUid }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !/already|exist|duplicate|409/i.test(error.message)) throw error;
  }
  try {
    await cometChatRequest(config, `/groups/${encodeURIComponent(groupId)}/members`, {
      method: "POST",
      body: JSON.stringify({ participants: [buyer.providerUid, seller.providerUid] }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !/already|member|409/i.test(error.message)) throw error;
  }

  await db.insert(chatConversations).values({ id, providerGroupId: groupId, listingId: listing.id, buyerEmail, sellerEmail: listing.ownerEmail }).onConflictDoNothing();
  const [saved] = await db.select().from(chatConversations).where(and(
    eq(chatConversations.listingId, listing.id),
    eq(chatConversations.buyerEmail, buyerEmail),
    eq(chatConversations.sellerEmail, listing.ownerEmail),
  )).limit(1);
  if (!saved) throw new Error("CHAT_CONVERSATION_CREATE_FAILED");
  return saved;
}
