import {
  safeRelativeReturnPath,
  serializeCookie,
} from "../chatgpt-auth";

const OAUTH_COOKIE = "tohoku_oauth";

export async function GET(request: Request) {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { GOOGLE_CLIENT_ID?: string };
  if (!runtimeEnv.GOOGLE_CLIENT_ID) {
    return new Response("Google 登录尚未配置，请联系管理员。", { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const returnTo = safeRelativeReturnPath(
    requestUrl.searchParams.get("return_to") ?? "/",
  );
  const state = crypto.randomUUID();
  const oauthState = encodeURIComponent(
    JSON.stringify({ state, returnTo, createdAt: Date.now() }),
  );
  const redirectUri = new URL("/callback", request.url).toString();
  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.searchParams.set("client_id", runtimeEnv.GOOGLE_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizationUrl.toString(),
      "set-cookie": serializeCookie(OAUTH_COOKIE, oauthState, { maxAge: 600 }),
      "cache-control": "no-store",
    },
  });
}
